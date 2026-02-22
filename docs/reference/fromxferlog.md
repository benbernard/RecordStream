# fromxferlog

Each line of input (or lines of &lt;files&gt;) is parsed as an FTP transfer log (xferlog format) to produce an output record.

## Synopsis

```bash
recs fromxferlog [files...]
```

## Description

Each line of input (or lines of &lt;files&gt;) is parsed as an FTP transfer log (xferlog format) to produce an output record. Fields include day_name, month, day, current_time, year, transfer_time, remote_host, file_size, filename, transfer_type, special_action_flag, direction, access_mode, username, service_name, authentication_method, authenticated_user_id, and completion_status.

## Examples

### Get records from typical xferlog
```bash
recs fromxferlog < /var/log/xferlog
```
