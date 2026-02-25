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
  extraArgs: string[] = [];

  acceptRecord(_record: Record): boolean {
    return true;
  }

  init(args: string[]): void {
    this.extraArgs = this.parseOptions(args, []);
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

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "fromxferlog",
  category: "input",
  synopsis: "recs fromxferlog [files...]",
  description:
    "Each line of input (or lines of <files>) is parsed as an FTP transfer log (xferlog format) to produce an output record. Fields include day_name, month, day, current_time, year, transfer_time, remote_host, file_size, filename, transfer_type, special_action_flag, direction, access_mode, username, service_name, authentication_method, authenticated_user_id, and completion_status.",
  options: [],
  examples: [
    {
      description: "Get records from typical xferlog",
      command: "recs fromxferlog < /var/log/xferlog",
    },
  ],
};
