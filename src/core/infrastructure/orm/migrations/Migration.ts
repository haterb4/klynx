import { DatabaseConnection } from "../../persistence/DatabaseConnection";
import { Model } from "../orm.model";
import { MigrationGenerator } from "./MigrationGenerator";

export class Migration {
  constructor(protected connection: DatabaseConnection) {}

  async up(): Promise<void> {}
  async down(): Promise<void> {}
}

export class JointTableMigration extends Migration {}

export async function runMigrations(
  connection: DatabaseConnection,
  modelsPath: string,
  migrationsPath: string
): Promise<void> {
  const generator = new MigrationGenerator(connection, modelsPath, migrationsPath);
  Model.setConnection(connection)
  await generator.generateAndRunMigrations();
}