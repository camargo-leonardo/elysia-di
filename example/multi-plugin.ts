import { Elysia } from "elysia";
import { di, Lifecycle } from "../src";

// Serviços
class Logger {
  private static instanceCount = 0;
  public readonly instanceId: number;

  constructor() {
    Logger.instanceCount++;
    this.instanceId = Logger.instanceCount;
    console.log(`✨ Logger instance #${this.instanceId} created`);
  }

  log(message: string) {
    console.log(`[LOG #${this.instanceId}] ${message}`);
  }

  static getInstanceCount() {
    return Logger.instanceCount;
  }
}

class DatabaseService {
  private static instanceCount = 0;
  public readonly instanceId: number;

  constructor(private logger: Logger) {
    DatabaseService.instanceCount++;
    this.instanceId = DatabaseService.instanceCount;
    console.log(
      `✨ DatabaseService instance #${this.instanceId} created (using Logger #${logger.instanceId})`
    );
  }

  query(sql: string) {
    this.logger.log(`[DB #${this.instanceId}] Executing: ${sql}`);
    return {
      success: true,
      data: [],
      dbInstance: this.instanceId,
      loggerInstance: this.logger.instanceId,
    };
  }

  static getInstanceCount() {
    return DatabaseService.instanceCount;
  }
}

// ✅ CORRETO: Criar o plugin DI UMA VEZ
const diPlugin = di({
  services: [
    {
      identifier: "logger",
      factory: () => new Logger(),
      lifecycle: Lifecycle.Singleton,
    },
    {
      identifier: "database",
      factory: (container) => {
        const logger = container.resolve<Logger>("logger");
        return new DatabaseService(logger);
      },
      lifecycle: Lifecycle.Singleton,
    },
  ] as const,
});

// Plugin de usuários - Precisa usar o mesmo diPlugin para ter tipagem correta
const usersPlugin = new Elysia({ prefix: "/users" })
  .use(diPlugin) // ✅ Usa a MESMA instância (não cria novo container)
  .get("/", ({ logger, database }) => {
    logger.log("Getting all users from usersPlugin");
    return database.query("SELECT * FROM users");
  })
  .get("/:id", ({ logger, params }) => {
    logger.log(`Getting user ${params.id} from usersPlugin`);
    return {
      id: params.id,
      name: "John Doe",
      loggerInstance: logger.instanceId,
    };
  });

// Plugin de produtos - também usa o mesmo diPlugin
const productsPlugin = new Elysia({ prefix: "/products" })
  .use(diPlugin) // ✅ Usa a MESMA instância (não cria novo container)
  .get("/", ({ logger, database }) => {
    logger.log("Getting all products from productsPlugin");
    return database.query("SELECT * FROM products");
  });

// App principal - usa o diPlugin UMA VEZ
const app = new Elysia()
  .use(diPlugin) // ✅ Injeção acontece aqui
  .use(usersPlugin) // ✅ Usa a mesma instância do diPlugin (container compartilhado)
  .use(productsPlugin) // ✅ Usa a mesma instância do diPlugin (container compartilhado)
  .get("/", ({ logger }) => {
    logger.log("Home endpoint from main app");
    return {
      message: "API with shared DI",
      loggerInstance: logger.instanceId,
      totalLoggerInstances: Logger.getInstanceCount(),
      totalDbInstances: DatabaseService.getInstanceCount(),
    };
  })
  .get("/test-instances", ({ logger, database }) => {
    logger.log("Testing instance sharing");
    const queryResult = database.query("SELECT 1");
    return {
      message: "Instance test",
      loggerInstance: logger.instanceId,
      databaseInstance: database.instanceId,
      totalLoggerInstances: Logger.getInstanceCount(),
      totalDbInstances: DatabaseService.getInstanceCount(),
      queryResult,
    };
  })
  .listen(3001);

console.log(
  `🦊 Multi-plugin example running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(`\n📊 Instance counts at startup:`);
console.log(`   Logger instances: ${Logger.getInstanceCount()}`);
console.log(`   Database instances: ${DatabaseService.getInstanceCount()}`);
console.log(`\n🧪 Test URLs:`);
console.log(`   http://localhost:3001/ - Main app`);
console.log(`   http://localhost:3001/users - Users plugin`);
console.log(`   http://localhost:3001/products - Products plugin`);
console.log(`   http://localhost:3001/test-instances - Instance test`);
