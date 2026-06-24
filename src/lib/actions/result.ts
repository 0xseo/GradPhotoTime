export type ActionResult<T> =
  | {
      data: T;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export function actionOk<T>(data: T): ActionResult<T> {
  return {
    data,
    ok: true,
  };
}

export function actionError<T = never>(error: string): ActionResult<T> {
  return {
    error,
    ok: false,
  };
}
