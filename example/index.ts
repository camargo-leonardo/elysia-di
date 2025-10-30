import { Elysia } from "elysia";
import { di, Lifecycle } from "../src";

// Define service interfaces and classes
interface ILogger {
  log(message: string): void;
  error(message: string): void;
}

class ConsoleLogger implements ILogger {
  log(message: string) {
    console.log(`[${new Date().toISOString()}] LOG: ${message}`);
  }

  error(message: string) {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
  }
}

class DatabaseService {
  private isConnected = false;

  constructor(private logger: ILogger) {}

  connect() {
    this.logger.log("Connecting to database...");
    this.isConnected = true;
    return this;
  }

  query(sql: string) {
    if (!this.isConnected) {
      this.logger.error("Database not connected!");
      throw new Error("Database not connected");
    }

    this.logger.log(`Executing query: ${sql}`);

    // Simulate database response
    return {
      data: [
        { id: "1", name: "John Doe", email: "john@example.com" },
        { id: "2", name: "Jane Smith", email: "jane@example.com" },
      ],
    };
  }
}

class UserRepository {
  constructor(private db: DatabaseService) {}

  findAll() {
    return this.db.query("SELECT * FROM users");
  }

  findById(id: string) {
    return this.db.query(`SELECT * FROM users WHERE id = '${id}'`);
  }

  create(name: string, email: string) {
    return this.db.query(
      `INSERT INTO users (name, email) VALUES ('${name}', '${email}')`
    );
  }
}

class UserService {
  constructor(private repository: UserRepository, private logger: ILogger) {}

  async getAllUsers() {
    this.logger.log("Getting all users");
    return this.repository.findAll();
  }

  async getUserById(id: string) {
    this.logger.log(`Getting user with id: ${id}`);
    return this.repository.findById(id);
  }

  async createUser(name: string, email: string) {
    this.logger.log(`Creating user: ${name} (${email})`);
    return this.repository.create(name, email);
  }
}

// Configure the application with DI
const app = new Elysia()
  .use(
    di({
      services: [
        // Singleton logger - shared across the entire application
        {
          identifier: "logger",
          factory: () => new ConsoleLogger(),
          lifecycle: Lifecycle.Singleton,
        },
        // Singleton database - one connection for the app
        {
          identifier: "database",
          factory: (container) => {
            const logger = container.resolve<ILogger>("logger");
            return new DatabaseService(logger).connect();
          },
          lifecycle: Lifecycle.Singleton,
        },
        // Scoped repository - new instance per request
        {
          identifier: "userRepository",
          factory: (container) => {
            const db = container.resolve<DatabaseService>("database");
            return new UserRepository(db);
          },
          lifecycle: Lifecycle.Scoped,
        },
        // Scoped service - new instance per request
        {
          identifier: "userService",
          factory: (container) => {
            const repository =
              container.resolve<UserRepository>("userRepository");
            const logger = container.resolve<ILogger>("logger");
            return new UserService(repository, logger);
          },
          lifecycle: Lifecycle.Scoped,
        },
      ] as const,
    })
  )
  .get("/", () => ({
    message: "Elysia DI Example",
    endpoints: {
      users: "/users",
      user: "/users/:id",
      create: "POST /users",
    },
  }))
  .get("/users", ({ userService }) => {
    return userService.getAllUsers();
  })
  .get("/users/:id", ({ userService, params }) => {
    return userService.getUserById(params.id);
  })
  .post("/users", async ({ userService, body }) => {
    const { name, email } = body as { name: string; email: string };
    return userService.createUser(name, email);
  })
  .listen(3000);

console.log(
  `🦊 Elysia DI example is running at ${app.server?.hostname}:${app.server?.port}`
);
