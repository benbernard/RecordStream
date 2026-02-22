# fromxferlog

Parse FTP transfer log (xferlog) entries into records.

## Synopsis

```bash
recs fromxferlog [files...]
```

## Description

`fromxferlog` reads FTP transfer logs in the standard xferlog format and emits one record per log entry. This is the format used by most FTP servers, including vsftpd, ProFTPD, and wu-ftpd. If you are still running an FTP server in this day and age, this command will at least help you figure out what is happening on it.

Each line is parsed into a comprehensive set of fields covering the timestamp, transfer duration, remote host, file information, transfer metadata, and authentication details. Lines that do not match the xferlog format are silently skipped.

The command takes no options beyond the standard input mechanism -- it simply parses every line it sees. Pass file paths as arguments or pipe data via stdin.

## Options

This command has no command-specific options. It reads from stdin or from files passed as arguments.

## Output Fields

| Field | Description |
|-------|-------------|
| `day_name` | Day of the week (e.g., `Mon`, `Tue`) |
| `month` | Month name (e.g., `Jan`, `Feb`) |
| `day` | Day of the month |
| `current_time` | Time of the transfer (HH:MM:SS) |
| `year` | Four-digit year |
| `transfer_time` | Duration of the transfer in seconds |
| `remote_host` | Hostname or IP of the remote client |
| `file_size` | Size of the transferred file in bytes |
| `filename` | Path of the transferred file |
| `transfer_type` | `a` (ASCII), `b` (binary), or `m` (mixed) |
| `special_action_flag` | Special action taken (e.g., `_` for none, `C` for compressed, `U` for uncompressed, `T` for tar) |
| `direction` | `o` (outgoing/download), `i` (incoming/upload), `d` (delete), `a` (append), `S` (SSL), `m` (mkdir) |
| `access_mode` | `r` (real/authenticated), `a` (anonymous), `g` (guest), `w` (password-check) |
| `username` | Username of the client |
| `service_name` | Name of the FTP service |
| `authentication_method` | Authentication method code |
| `authenticated_user_id` | Authenticated user ID string |
| `completion_status` | `c` (complete) or `i` (incomplete) |

## Examples

### Parse a standard xferlog
```bash
recs fromxferlog < /var/log/xferlog
```

### Find all failed (incomplete) transfers
```bash
recs fromxferlog /var/log/xferlog \
  | recs grep '{{completion_status}} eq "i"'
```

### Summarize transfer volume by user
```bash
recs fromxferlog /var/log/xferlog \
  | recs collate --key username --aggregator 'sum(file_size)' \
  | recs sort --key 'sum_file_size=-n'
```

### Find the largest files transferred
```bash
recs fromxferlog /var/log/xferlog \
  | recs sort --key file_size=-n \
  | recs topn --n 20 \
  | recs totable --key filename,file_size,username,direction
```

### Count downloads vs uploads
```bash
recs fromxferlog /var/log/xferlog \
  | recs collate --key direction --aggregator count
```

### Find anonymous access
```bash
recs fromxferlog /var/log/xferlog \
  | recs grep '{{access_mode}} eq "a"'
```

## Notes

- The xferlog format is defined by wu-ftpd and is documented in `man xferlog(5)` on most systems.
- Filenames may contain spaces; the parser handles this correctly.
- Lines that do not match the expected format are silently skipped.

## See Also

- [fromapache](./fromapache) - For parsing HTTP access logs
- [fromre](./fromre) - For parsing other log formats with a custom regex
