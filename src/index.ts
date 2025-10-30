import { Elysia } from "elysia";
import { Container } from "./container";

import type {
  DIOptions,
  ClassRegistration,
  ServiceRegistration,
  BuildServicesObject,
  InstanceRegistration,
} from "./types";

export function di<
  const Services extends readonly ServiceRegistration[],
  const Classes extends readonly ClassRegistration[],
  const Instances extends readonly InstanceRegistration[]
>(options: DIOptions<Services, Classes, Instances> = {}) {
  const {
    services = [] as unknown as Services,
    classes = [] as unknown as Classes,
    instances = [] as unknown as Instances,
    enableScoping = true,
  } = options;
  const container = new Container();

  // Register all services, classes, and instances
  for (const registration of services) {
    if ("factory" in registration) {
      const { identifier, factory, lifecycle } =
        registration as ServiceRegistration;
      container.register(identifier, factory, lifecycle);
    }
  }

  for (const registration of classes) {
    const { identifier, classConstructor, lifecycle } =
      registration as ClassRegistration;
    container.registerClass(identifier, classConstructor, lifecycle);
  }

  for (const registration of instances) {
    const { identifier, instance } = registration as InstanceRegistration;
    container.registerInstance(identifier, instance);
  }

  type AllRegistrations = [...Services, ...Classes, ...Instances];
  type ServicesObject = BuildServicesObject<AllRegistrations>;

  const stringIdentifiers = [
    ...services.map((s) => ("identifier" in s ? s.identifier : null)),
    ...classes.map((c) => c.identifier),
    ...instances.map((i) => i.identifier),
  ].filter((id): id is string => typeof id === "string");

  if (enableScoping) {
    return new Elysia({ name: "elysia-di" })
      .derive({ as: "global" }, (context) => {
        const scopedContainer = container.createScope();
        const services = {} as ServicesObject;

        for (const identifier of stringIdentifiers) {
          Object.defineProperty(services, identifier, {
            get: () => scopedContainer.resolve(identifier),
            enumerable: true,
          });
        }

        (context as any)._scopedContainer = scopedContainer;
        return services;
      })
      .onAfterResponse((context: any) => {
        if (context._scopedContainer) {
          context._scopedContainer.clearScope();
        }
      });
  } else {
    const services = {} as ServicesObject;

    for (const identifier of stringIdentifiers) {
      Object.defineProperty(services, identifier, {
        get: () => container.resolve(identifier),
        enumerable: true,
      });
    }

    return new Elysia({ name: "elysia-di" }).derive(
      { as: "global" },
      () => services
    );
  }
}

export * from "./container";
export * from "./types";
