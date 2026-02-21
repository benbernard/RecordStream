import { KeyPerfectClumper } from "./KeyPerfect.ts";
import { clumperRegistry } from "../Clumper.ts";

export class CubeKeyPerfectClumper extends KeyPerfectClumper {
  protected override getValues(value: string): string[] {
    return [value, "ALL"];
  }
}

clumperRegistry.register("cubekeyperfect", {
  create: (field: string) => new CubeKeyPerfectClumper(field),
  argCounts: [1],
  shortUsage: "clump records by the value for a key, additionally cubing them",
  longUsage: "Usage: cubekeyperfect,<keyspec>\n   Clump records by the value for a key and additionally produce an \"ALL\" slice.",
});
