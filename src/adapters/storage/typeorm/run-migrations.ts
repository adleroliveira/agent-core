import { DataSource } from "typeorm";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../../../.env") });

const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_DATABASE || "agent_core",
  entities: [__dirname + "/entities/*.entity.ts"],
  migrations: [__dirname + "/migrations/*.ts"],
  synchronize: false,
});

AppDataSource.initialize()
  .then(() => {
    console.log("Data Source has been initialized!");
    return AppDataSource.runMigrations();
  })
  .then(() => {
    console.log("Migrations have been run successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error during Data Source initialization:", error);
    process.exit(1);
  }); 