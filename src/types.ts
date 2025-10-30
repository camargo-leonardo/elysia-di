import type { Factory, Class } from "./container";

export interface ServiceRegistration<
  TIdentifier extends string = string,
  TService = any
> {
  identifier: TIdentifier;
  factory: Factory<TService>;
  lifecycle?: import("./container").Lifecycle;
}

export interface ClassRegistration<
  TIdentifier extends string = string,
  TService = any
> {
  identifier: TIdentifier;
  classConstructor: Class<TService>;
  lifecycle?: import("./container").Lifecycle;
}

export interface InstanceRegistration<
  TIdentifier extends string = string,
  TInstance = any
> {
  identifier: TIdentifier;
  instance: TInstance;
}

export type ExtractServiceType<T> = T extends ServiceRegistration<any, infer U>
  ? U
  : T extends ClassRegistration<any, infer U>
  ? U
  : T extends InstanceRegistration<any, infer U>
  ? U
  : never;

export type ExtractIdentifier<T> = T extends { identifier: infer I }
  ? I extends string
    ? I
    : never
  : never;

export type BuildServicesObject<
  Services extends readonly (
    | ServiceRegistration
    | ClassRegistration
    | InstanceRegistration
    | any
  )[]
> = {
  [K in Services[number] as ExtractIdentifier<K>]: ExtractServiceType<K>;
};

export interface DIOptions<
  Services extends readonly ServiceRegistration[],
  Classes extends readonly ClassRegistration[],
  Instances extends readonly InstanceRegistration[]
> {
  services?: Services;
  classes?: Classes;
  instances?: Instances;
  enableScoping?: boolean;
}
