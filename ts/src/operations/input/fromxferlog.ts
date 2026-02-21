import { Operation } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import type { JsonObject } from "../../types/json.ts";

/**
 * Xferlog (FTP transfer log) format regex.
 *
 * Format: DayOfWeek Month Day HH:MM:SS Year TransferTime RemoteHost FileSize Filename TransferType SpecialAction Direction AccessMode Username ServiceName AuthMethod AuthUserId CompletionStatus
 *
 * Note: The filename can contain spaces, so we need special parsing.
 */
const XFERLOG_RE =
  /^(\w+)\s+(\w+)\s+(\d+)\s+(\d{2}:\d{2}:\d{2})\s+(\d{4})\s+(\d+)\s+(\S+)\s+(\d+)\s+(.*?)\s+([abm])\s+(\S+)\s+([oidaSm])\s+([ragw])\s+(\S+)\s+(\S+)\s+(\d+)\s+(\S+)\s+([ci])$/;

/**
 * Parse FTP transfer log (xferlog) lines into records.
 *
 * Analogous to App::RecordStream::Operation::fromxferlog in Perl.
 */
export class FromXferlog extends Operation {
  acceptRecord(_record: Record): boolean {
    return true;
  }

  init(_args: string[]): void {
    // No options
  }

  processLine(line: string): void {
    const m = XFERLOG_RE.exec(line);
    if (!m) return;

    const data: JsonObject = {
      day_name: m[1]!,
      month: m[2]!,
      day: m[3]!,
      current_time: m[4]!,
      year: m[5]!,
      transfer_time: m[6]!,
      remote_host: m[7]!,
      file_size: m[8]!,
      filename: m[9]!,
      transfer_type: m[10]!,
      special_action_flag: m[11]!,
      direction: m[12]!,
      access_mode: m[13]!,
      username: m[14]!,
      service_name: m[15]!,
      authentication_method: m[16]!,
      authenticated_user_id: m[17]!,
      completion_status: m[18]!,
    };

    this.pushRecord(new Record(data));
  }

  override acceptLine(line: string): boolean {
    this.processLine(line);
    return true;
  }
}
