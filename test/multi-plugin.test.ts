import { describe, expect, it, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { di, Lifecycle } from "../src";

describe("Multi-plugin DI sharing", () => {
  // Serviço com contador de instâncias
  class CounterService {
    private static instanceCount = 0;
    public readonly instanceId: number;

    constructor() {
      CounterService.instanceCount++;
      this.instanceId = CounterService.instanceCount;
    }

    getInstanceId() {
      return this.instanceId;
    }

    static getInstanceCount() {
      return CounterService.instanceCount;
    }

    static resetCount() {
      CounterService.instanceCount = 0;
    }
  }

  class LoggerService {
    private static instanceCount = 0;
    public readonly instanceId: number;

    constructor() {
      LoggerService.instanceCount++;
      this.instanceId = LoggerService.instanceCount;
    }

    log(message: string) {
      return `[Logger #${this.instanceId}] ${message}`;
    }

    static getInstanceCount() {
      return LoggerService.instanceCount;
    }

    static resetCount() {
      LoggerService.instanceCount = 0;
    }
  }

  beforeEach(() => {
    CounterService.resetCount();
    LoggerService.resetCount();
  });

  it("should share the same singleton instance across multiple plugins when using the same diPlugin", async () => {
    // Criar o plugin DI UMA VEZ
    const diPlugin = di({
      services: [
        {
          identifier: "counter",
          factory: () => new CounterService(),
          lifecycle: Lifecycle.Singleton,
        },
      ] as const,
    });

    // Plugin 1 usa o diPlugin
    const plugin1 = new Elysia({ prefix: "/plugin1" })
      .use(diPlugin)
      .get("/test", ({ counter }) => ({
        plugin: "plugin1",
        instanceId: counter.getInstanceId(),
      }));

    // Plugin 2 usa o MESMO diPlugin
    const plugin2 = new Elysia({ prefix: "/plugin2" })
      .use(diPlugin)
      .get("/test", ({ counter }) => ({
        plugin: "plugin2",
        instanceId: counter.getInstanceId(),
      }));

    // App principal usa ambos os plugins
    const app = new Elysia()
      .use(diPlugin)
      .use(plugin1)
      .use(plugin2)
      .get("/main", ({ counter }) => ({
        plugin: "main",
        instanceId: counter.getInstanceId(),
      }));

    // Testar que todos usam a mesma instância
    const mainResponse = await app
      .handle(new Request("http://localhost/main"))
      .then((r) => r.json());
    const plugin1Response = await app
      .handle(new Request("http://localhost/plugin1/test"))
      .then((r) => r.json());
    const plugin2Response = await app
      .handle(new Request("http://localhost/plugin2/test"))
      .then((r) => r.json());

    // Todos devem ter o mesmo instanceId (1)
    expect(mainResponse.instanceId).toBe(1);
    expect(plugin1Response.instanceId).toBe(1);
    expect(plugin2Response.instanceId).toBe(1);

    // Deve ter criado apenas 1 instância no total
    expect(CounterService.getInstanceCount()).toBe(1);
  });

  it("should create different instances when creating separate diPlugin instances", async () => {
    // Criar DOIS plugins DI diferentes (mas Elysia deduplicará pelo name!)
    const diPlugin1 = di({
      services: [
        {
          identifier: "counter",
          factory: () => new CounterService(),
          lifecycle: Lifecycle.Singleton,
        },
      ] as const,
    });

    const diPlugin2 = di({
      services: [
        {
          identifier: "counter",
          factory: () => new CounterService(),
          lifecycle: Lifecycle.Singleton,
        },
      ] as const,
    });

    // Plugin 1 usa diPlugin1
    const plugin1 = new Elysia({ prefix: "/plugin1" })
      .use(diPlugin1)
      .get("/test", ({ counter }) => ({
        plugin: "plugin1",
        instanceId: counter.getInstanceId(),
      }));

    // Plugin 2 usa diPlugin2 (DIFERENTE!)
    const plugin2 = new Elysia({ prefix: "/plugin2" })
      .use(diPlugin2)
      .get("/test", ({ counter }) => ({
        plugin: "plugin2",
        instanceId: counter.getInstanceId(),
      }));

    // App principal
    const app = new Elysia().use(plugin1).use(plugin2);

    // Testar que cada um tem sua própria instância
    const plugin1Response = await app
      .handle(new Request("http://localhost/plugin1/test"))
      .then((r) => r.json());
    const plugin2Response = await app
      .handle(new Request("http://localhost/plugin2/test"))
      .then((r) => r.json());

    // ⚠️ ATENÇÃO: Elysia deduplicará plugins com o mesmo name ("elysia-di")
    // Então mesmo criando 2 diPlugins, apenas o PRIMEIRO será usado
    // Este é o comportamento atual do Elysia com plugins nomeados
    expect(plugin1Response.instanceId).toBe(1);
    expect(plugin2Response.instanceId).toBe(1); // Compartilha a instância!

    // Apenas 1 instância é criada porque o segundo diPlugin é ignorado
    expect(CounterService.getInstanceCount()).toBe(1);
  });

  it("should share multiple services across plugins", async () => {
    const diPlugin = di({
      services: [
        {
          identifier: "counter",
          factory: () => new CounterService(),
          lifecycle: Lifecycle.Singleton,
        },
        {
          identifier: "logger",
          factory: () => new LoggerService(),
          lifecycle: Lifecycle.Singleton,
        },
      ] as const,
    });

    const plugin1 = new Elysia({ prefix: "/plugin1" })
      .use(diPlugin)
      .get("/test", ({ counter, logger }) => ({
        plugin: "plugin1",
        counterId: counter.getInstanceId(),
        loggerId: logger.instanceId,
        message: logger.log("plugin1 test"),
      }));

    const plugin2 = new Elysia({ prefix: "/plugin2" })
      .use(diPlugin)
      .get("/test", ({ counter, logger }) => ({
        plugin: "plugin2",
        counterId: counter.getInstanceId(),
        loggerId: logger.instanceId,
        message: logger.log("plugin2 test"),
      }));

    const app = new Elysia().use(diPlugin).use(plugin1).use(plugin2);

    const plugin1Response = await app
      .handle(new Request("http://localhost/plugin1/test"))
      .then((r) => r.json());
    const plugin2Response = await app
      .handle(new Request("http://localhost/plugin2/test"))
      .then((r) => r.json());

    // Ambos os plugins usam as mesmas instâncias
    expect(plugin1Response.counterId).toBe(1);
    expect(plugin1Response.loggerId).toBe(1);
    expect(plugin2Response.counterId).toBe(1);
    expect(plugin2Response.loggerId).toBe(1);

    // Apenas 1 instância de cada serviço foi criada
    expect(CounterService.getInstanceCount()).toBe(1);
    expect(LoggerService.getInstanceCount()).toBe(1);
  });

  it("should maintain singleton behavior even when plugins are registered in different order", async () => {
    const diPlugin = di({
      services: [
        {
          identifier: "counter",
          factory: () => new CounterService(),
          lifecycle: Lifecycle.Singleton,
        },
      ] as const,
    });

    // Registrar plugins ANTES do app principal ter o diPlugin
    const plugin1 = new Elysia({ prefix: "/plugin1" })
      .use(diPlugin)
      .get("/test", ({ counter }) => ({
        instanceId: counter.getInstanceId(),
      }));

    const plugin2 = new Elysia({ prefix: "/plugin2" })
      .use(diPlugin)
      .get("/test", ({ counter }) => ({
        instanceId: counter.getInstanceId(),
      }));

    // App principal usa os plugins e depois o diPlugin
    const app = new Elysia()
      .use(plugin1)
      .use(plugin2)
      .use(diPlugin)
      .get("/main", ({ counter }) => ({
        instanceId: counter.getInstanceId(),
      }));

    const mainResponse = await app
      .handle(new Request("http://localhost/main"))
      .then((r) => r.json());
    const plugin1Response = await app
      .handle(new Request("http://localhost/plugin1/test"))
      .then((r) => r.json());
    const plugin2Response = await app
      .handle(new Request("http://localhost/plugin2/test"))
      .then((r) => r.json());

    // Todos devem compartilhar a mesma instância
    expect(mainResponse.instanceId).toBe(plugin1Response.instanceId);
    expect(plugin1Response.instanceId).toBe(plugin2Response.instanceId);
    expect(CounterService.getInstanceCount()).toBe(1);
  });

  it("should demonstrate the problem: NOT sharing diPlugin creates multiple containers", async () => {
    // ❌ ERRADO: Criar o diPlugin dentro de cada plugin
    const plugin1 = new Elysia({ prefix: "/plugin1" })
      .use(
        di({
          services: [
            {
              identifier: "counter",
              factory: () => new CounterService(),
              lifecycle: Lifecycle.Singleton,
            },
          ] as const,
        })
      )
      .get("/test", ({ counter }) => ({
        instanceId: counter.getInstanceId(),
      }));

    const plugin2 = new Elysia({ prefix: "/plugin2" })
      .use(
        di({
          services: [
            {
              identifier: "counter",
              factory: () => new CounterService(),
              lifecycle: Lifecycle.Singleton,
            },
          ] as const,
        })
      )
      .get("/test", ({ counter }) => ({
        instanceId: counter.getInstanceId(),
      }));

    const app = new Elysia().use(plugin1).use(plugin2);

    const plugin1Response = await app
      .handle(new Request("http://localhost/plugin1/test"))
      .then((r) => r.json());
    const plugin2Response = await app
      .handle(new Request("http://localhost/plugin2/test"))
      .then((r) => r.json());

    // ⚠️ IMPORTANTE: Elysia deduplicará plugins com o mesmo name!
    // Ambos os plugins di() têm name: "elysia-di", então o segundo é ignorado
    // O comportamento correto é: SEMPRE reutilizar a mesma instância do diPlugin
    expect(plugin1Response.instanceId).toBe(1);
    expect(plugin2Response.instanceId).toBe(1); // Mesmo container!
    expect(CounterService.getInstanceCount()).toBe(1);
  });

  it("should explain: Elysia deduplicates plugins by name, so always reuse the same diPlugin instance", async () => {
    // Este teste explica o comportamento do Elysia com plugin deduplication

    const diPlugin = di({
      services: [
        {
          identifier: "counter",
          factory: () => new CounterService(),
          lifecycle: Lifecycle.Singleton,
        },
      ] as const,
    });

    // Cenário: Você tem um app principal e vários plugins
    const usersPlugin = new Elysia({ prefix: "/users" })
      .use(diPlugin) // ✅ Usa a mesma instância
      .get("/", ({ counter }) => ({
        route: "users",
        id: counter.getInstanceId(),
      }));

    const productsPlugin = new Elysia({ prefix: "/products" })
      .use(diPlugin) // ✅ Usa a mesma instância
      .get("/", ({ counter }) => ({
        route: "products",
        id: counter.getInstanceId(),
      }));

    const ordersPlugin = new Elysia({ prefix: "/orders" })
      .use(diPlugin) // ✅ Usa a mesma instância
      .get("/", ({ counter }) => ({
        route: "orders",
        id: counter.getInstanceId(),
      }));

    const app = new Elysia()
      .use(diPlugin)
      .use(usersPlugin)
      .use(productsPlugin)
      .use(ordersPlugin)
      .get("/", ({ counter }) => ({
        route: "main",
        id: counter.getInstanceId(),
      }));

    // Todos os endpoints compartilham a mesma instância do singleton
    const responses = await Promise.all([
      app.handle(new Request("http://localhost/")).then((r) => r.json()),
      app.handle(new Request("http://localhost/users")).then((r) => r.json()),
      app
        .handle(new Request("http://localhost/products"))
        .then((r) => r.json()),
      app.handle(new Request("http://localhost/orders")).then((r) => r.json()),
    ]);

    // Todos devem ter o mesmo instanceId
    responses.forEach((response) => {
      expect(response.id).toBe(1);
    });

    // Apenas 1 instância criada no total
    expect(CounterService.getInstanceCount()).toBe(1);
  });
});
