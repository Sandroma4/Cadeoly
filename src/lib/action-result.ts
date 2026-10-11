export type ActionFailure = {
  error: string;
  fields?: string[];
  success?: never;
};
export type ActionResult<T extends object = Record<never, never>> =
  | ({ success: true; error?: never; fields?: never } & T)
  | ActionFailure;
