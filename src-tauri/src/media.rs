//! The `media` protocol: how the WebView reads a video file off disk.
//!
//! Tauri's own `asset` protocol answers every range with at most 1000 KiB,
//! whatever was asked for. The media stack keeps reading when the payload runs
//! out, but WebKit parses an MP4's `moov` itself first, reading each box whole,
//! and a box cut short there is not re-requested: the track it describes is
//! dropped. A two-hour film's `ctts` (one composition offset per frame) is
//! about 1.1 MB, so its video track vanished and the file played as audio over
//! a black picture, the clock still running. Measured on the live file, not
//! reasoned about; a 16 MiB cap already plays it.
//!
//! So a range with an end is answered whole, and only a range left open —
//! `bytes=a-`, which asks for the rest of a file that can be gigabytes — is
//! answered in chunks for the element to come back for.

use std::fs::{self, File};
use std::io::{self, Read, Seek, SeekFrom};
use tauri::http::{header, Request, Response, StatusCode};
use tauri::utils::mime_type::MimeType;

/// The URI scheme, and the one `convertFileSrc` is given in the frontend
/// (`MEDIA_SCHEME` in `src/lib/player.ts`).
pub const SCHEME: &str = "media";

/// Most bytes sent for a range left open: enough that playback is not a storm
/// of small reads, little enough that a seek does not wait on a large one.
const OPEN_RANGE_CHUNK: u64 = 4 * 1024 * 1024;

/// Most bytes sent for a range with an end. Only a runaway request comes near
/// it; the largest box a player asks for whole is a few megabytes.
const CLOSED_RANGE_LIMIT: u64 = 64 * 1024 * 1024;

/// Bytes read to tell the file's type, the same amount Tauri's `asset` sniffs.
const SNIFF_LEN: u64 = 8192;

/// One range out of a `Range` header, as written.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ByteRange {
    /// `bytes=a-`: from `a` to the end of the file.
    From(u64),
    /// `bytes=a-b`: `a` through `b`, inclusive.
    Closed(u64, u64),
    /// `bytes=-n`: the last `n` bytes.
    Suffix(u64),
}

/// Reads a `Range` header. A media element never asks for more than one range,
/// so only the first is honoured; anything unreadable is `None`, which is
/// answered like a request without the header.
fn parse_range(value: &str) -> Option<ByteRange> {
    let spec = value.trim().strip_prefix("bytes=")?;
    let first = spec.split(',').next()?.trim();
    let (start, end) = first.split_once('-')?;
    let (start, end) = (start.trim(), end.trim());
    match (start.is_empty(), end.is_empty()) {
        (false, true) => start.parse().ok().map(ByteRange::From),
        (false, false) => {
            let (start, end) = (start.parse().ok()?, end.parse().ok()?);
            (start <= end).then_some(ByteRange::Closed(start, end))
        }
        (true, false) => end.parse().ok().map(ByteRange::Suffix),
        (true, true) => None,
    }
}

/// The inclusive span of a `len`-byte file to send for `range`, or `None` when
/// nothing in the file satisfies it. No range at all reads like `bytes=0-`.
fn span(range: Option<ByteRange>, len: u64) -> Option<(u64, u64)> {
    let last = len.checked_sub(1)?;
    let (start, end, limit) = match range.unwrap_or(ByteRange::From(0)) {
        ByteRange::From(start) => (start, last, OPEN_RANGE_CHUNK),
        ByteRange::Closed(start, end) => (start, end.min(last), CLOSED_RANGE_LIMIT),
        ByteRange::Suffix(0) => return None,
        ByteRange::Suffix(count) => (len.saturating_sub(count), last, CLOSED_RANGE_LIMIT),
    };
    if start > last {
        return None;
    }
    Some((start, end.min(start.saturating_add(limit - 1))))
}

/// Answers one request for a file.
///
/// The path is the URL's, percent-decoded: `convertFileSrc` encodes the whole
/// native path into it, drive letter and separators included. The asset
/// protocol this replaces was scoped to `**`, so any file is served, as it was.
pub fn respond(request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let path = request.uri().path().strip_prefix('/').unwrap_or_default();
    let path = percent_encoding::percent_decode_str(path)
        .decode_utf8_lossy()
        .into_owned();
    let range = request
        .headers()
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok())
        .and_then(parse_range);

    serve(&path, range).unwrap_or_else(|error| {
        let status = match error.kind() {
            io::ErrorKind::NotFound => StatusCode::NOT_FOUND,
            io::ErrorKind::PermissionDenied => StatusCode::FORBIDDEN,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        empty(status)
    })
}

fn serve(path: &str, range: Option<ByteRange>) -> io::Result<Response<Vec<u8>>> {
    // Checked before opening: Windows refuses to open a directory at all, and
    // that would read as a permission problem rather than a missing file.
    let metadata = fs::metadata(path)?;
    if !metadata.is_file() {
        return Err(io::ErrorKind::NotFound.into());
    }
    let len = metadata.len();
    let mut file = File::open(path)?;

    let mut magic = Vec::new();
    (&mut file).take(SNIFF_LEN).read_to_end(&mut magic)?;
    let mime = MimeType::parse(&magic, path);

    let Some((start, end)) = span(range, len) else {
        let mut response = empty(StatusCode::RANGE_NOT_SATISFIABLE);
        if let Ok(value) = format!("bytes */{len}").parse() {
            response.headers_mut().insert(header::CONTENT_RANGE, value);
        }
        return Ok(response);
    };

    let count = end + 1 - start;
    let mut body = Vec::with_capacity(count as usize);
    file.seek(SeekFrom::Start(start))?;
    file.take(count).read_to_end(&mut body)?;

    Response::builder()
        .status(StatusCode::PARTIAL_CONTENT)
        .header(header::CONTENT_TYPE, mime)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{len}"))
        .header(header::CONTENT_LENGTH, body.len())
        .body(body)
        .map_err(io::Error::other)
}

fn empty(status: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = status;
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn parses_each_range_form() {
        assert_eq!(parse_range("bytes=0-"), Some(ByteRange::From(0)));
        assert_eq!(parse_range("bytes=10-19"), Some(ByteRange::Closed(10, 19)));
        assert_eq!(parse_range("bytes=-500"), Some(ByteRange::Suffix(500)));
        assert_eq!(parse_range(" bytes= 5 - 6 "), Some(ByteRange::Closed(5, 6)));
    }

    /// Only the first of several ranges is honoured.
    #[test]
    fn takes_the_first_of_several_ranges() {
        assert_eq!(parse_range("bytes=0-1, 5-6"), Some(ByteRange::Closed(0, 1)));
    }

    #[test]
    fn ignores_ranges_it_cannot_read() {
        for value in [
            "",
            "bytes=",
            "bytes=-",
            "bytes=9-3",
            "bytes=a-b",
            "items=0-1",
            "bytes=0",
        ] {
            assert_eq!(parse_range(value), None, "{value:?}");
        }
    }

    /// The regression: a closed range past the old 1000 KiB cap — the `ctts`
    /// request WebKit made for the two-hour film — is answered whole.
    #[test]
    fn answers_a_closed_range_whole() {
        let len = 3_793_591_778;
        assert_eq!(
            span(Some(ByteRange::Closed(4686, 1_177_557)), len),
            Some((4686, 1_177_557))
        );
    }

    #[test]
    fn caps_a_runaway_closed_range() {
        assert_eq!(
            span(Some(ByteRange::Closed(0, u64::MAX - 1)), u64::MAX),
            Some((0, CLOSED_RANGE_LIMIT - 1))
        );
    }

    #[test]
    fn chunks_an_open_range() {
        let len = 10 * OPEN_RANGE_CHUNK;
        assert_eq!(
            span(Some(ByteRange::From(100)), len),
            Some((100, 100 + OPEN_RANGE_CHUNK - 1))
        );
        // Near the end, the chunk is whatever is left.
        assert_eq!(
            span(Some(ByteRange::From(len - 10)), len),
            Some((len - 10, len - 1))
        );
        // No header at all reads like `bytes=0-`.
        assert_eq!(span(None, len), Some((0, OPEN_RANGE_CHUNK - 1)));
    }

    #[test]
    fn clamps_to_the_end_of_the_file() {
        assert_eq!(span(Some(ByteRange::Closed(5, 999)), 10), Some((5, 9)));
        assert_eq!(span(Some(ByteRange::Suffix(4)), 10), Some((6, 9)));
        assert_eq!(span(Some(ByteRange::Suffix(99)), 10), Some((0, 9)));
    }

    #[test]
    fn refuses_what_the_file_cannot_satisfy() {
        assert_eq!(span(Some(ByteRange::From(10)), 10), None);
        assert_eq!(span(Some(ByteRange::Closed(10, 20)), 10), None);
        assert_eq!(span(Some(ByteRange::Suffix(0)), 10), None);
        assert_eq!(span(None, 0), None);
    }

    /// A scratch file that removes itself when the test ends.
    struct TempFile(PathBuf);

    impl TempFile {
        fn new(name: &str, contents: &[u8]) -> Self {
            let path =
                std::env::temp_dir().join(format!("mirror-media-{name}-{}", std::process::id()));
            fs::write(&path, contents).expect("a scratch file");
            Self(path)
        }

        /// The request `convertFileSrc(path, "media")` leads the WebView to make.
        fn request(&self, range: Option<&str>) -> Request<Vec<u8>> {
            let path = self.0.to_string_lossy();
            let encoded =
                percent_encoding::utf8_percent_encode(&path, percent_encoding::NON_ALPHANUMERIC);
            let mut builder = Request::builder().uri(format!("{SCHEME}://localhost/{encoded}"));
            if let Some(range) = range {
                builder = builder.header(header::RANGE, range);
            }
            builder.body(Vec::new()).expect("a request")
        }
    }

    impl Drop for TempFile {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.0);
        }
    }

    fn header_of(response: &Response<Vec<u8>>, name: header::HeaderName) -> &str {
        response
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
    }

    #[test]
    fn serves_the_requested_bytes() {
        let contents: Vec<u8> = (0..=255).collect();
        let file = TempFile::new("bytes", &contents);

        let response = respond(&file.request(Some("bytes=10-19")));

        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.body(), &contents[10..=19]);
        assert_eq!(
            header_of(&response, header::CONTENT_RANGE),
            "bytes 10-19/256"
        );
        assert_eq!(header_of(&response, header::CONTENT_LENGTH), "10");
        assert_eq!(header_of(&response, header::ACCEPT_RANGES), "bytes");
    }

    #[test]
    fn sniffs_the_content_type() {
        // An MP4 opens with its `ftyp` box.
        let mut contents = b"\0\0\0\x20ftypisom\0\0\x02\0isomiso2avc1mp41".to_vec();
        contents.resize(64, 0);
        let file = TempFile::new("mp4", &contents);

        let response = respond(&file.request(Some("bytes=0-1")));

        assert_eq!(header_of(&response, header::CONTENT_TYPE), "video/mp4");
    }

    #[test]
    fn refuses_a_range_past_the_end() {
        let file = TempFile::new("short", b"0123456789");

        let response = respond(&file.request(Some("bytes=10-")));

        assert_eq!(response.status(), StatusCode::RANGE_NOT_SATISFIABLE);
        assert_eq!(header_of(&response, header::CONTENT_RANGE), "bytes */10");
        assert!(response.body().is_empty());
    }

    #[test]
    fn answers_a_missing_file_with_not_found() {
        let file = TempFile::new("gone", b"");
        let request = file.request(None);
        drop(file);

        assert_eq!(respond(&request).status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn does_not_serve_a_directory() {
        let dir = std::env::temp_dir();
        let path = dir.to_string_lossy();
        let encoded =
            percent_encoding::utf8_percent_encode(&path, percent_encoding::NON_ALPHANUMERIC);
        let request = Request::builder()
            .uri(format!("{SCHEME}://localhost/{encoded}"))
            .body(Vec::new())
            .expect("a request");

        assert_eq!(respond(&request).status(), StatusCode::NOT_FOUND);
    }
}
