import "reflect-metadata";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Request bodies can carry document data; keep payload logging off.
    logger: ["error", "warn", "log"],
  });

  app.use(helmet());
  app.enableCors({
    origin: [
      process.env.USER_APP_URL ?? "http://localhost:3000",
      process.env.MERCHANT_APP_URL ?? "http://localhost:3001",
      process.env.ADMIN_APP_URL ?? "http://localhost:3002",
    ],
    credentials: true,
  });

  app.setGlobalPrefix("", { exclude: ["health"] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const swagger = new DocumentBuilder()
    .setTitle("MyIDx API")
    .setDescription("Identity vault, verification and merchant OAuth")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swagger));

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
