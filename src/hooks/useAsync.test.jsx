import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useAsync from "./useAsync";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useAsync", () => {
  it("starts loading with the initial data, then delivers the data", async () => {
    const d = deferred();
    const { result } = renderHook(() => useAsync(() => d.promise, [], { initialData: [] }));
    expect(result.current).toMatchObject({ loading: true, error: null, data: [] });
    d.resolve(["a"]);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(["a"]);
    expect(result.current.error).toBeNull();
  });

  it("reports an error and keeps the previous data", async () => {
    const boom = new Error("boom");
    const { result } = renderHook(() => useAsync(() => Promise.reject(boom), [], { initialData: ["kept"] }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(boom);
    expect(result.current.data).toEqual(["kept"]);
  });

  it("ignores an answer that arrives after the component left", async () => {
    const d = deferred();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useAsync(() => d.promise));
    unmount();
    await act(async () => {
      d.resolve("late");
      await d.promise;
    });
    expect(result.current.data).toBeNull(); // no update was applied
    expect(errors).not.toHaveBeenCalled(); // and no "state update on an unmounted component"
  });

  it("ignores a stale answer when deps change: only the latest request counts", async () => {
    const slow = deferred();
    const fast = deferred();
    const calls = [slow, fast];
    let i = 0;
    const { result, rerender } = renderHook(({ id }) => useAsync(() => calls[i++].promise, [id]), { initialProps: { id: 1 } });
    rerender({ id: 2 });
    fast.resolve("second");
    await waitFor(() => expect(result.current.data).toBe("second"));
    await act(async () => {
      slow.resolve("first (stale)");
      await slow.promise;
    });
    expect(result.current.data).toBe("second");
  });

  it("ignores a stale FAILURE too: an old request failing late does not show an error over fresh data", async () => {
    const slow = deferred();
    const fast = deferred();
    const calls = [slow, fast];
    let i = 0;
    const { result, rerender } = renderHook(({ id }) => useAsync(() => calls[i++].promise, [id]), { initialProps: { id: 1 } });
    rerender({ id: 2 });
    fast.resolve("fresh");
    await waitFor(() => expect(result.current.data).toBe("fresh"));
    await act(async () => {
      slow.reject(new Error("old request failed"));
      await slow.promise.catch(() => {});
    });
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe("fresh");
  });

  it("loads again when deps change, and not otherwise", async () => {
    const fetcher = vi.fn().mockResolvedValue("x");
    const { rerender } = renderHook(({ id }) => useAsync(fetcher, [id]), { initialProps: { id: 1 } });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    rerender({ id: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    rerender({ id: 2 });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("uses the latest fetcher, so a closure over fresh values is never stale", async () => {
    const { result, rerender } = renderHook(({ q }) => useAsync(() => Promise.resolve(`q=${q}`), [q]), { initialProps: { q: "a" } });
    await waitFor(() => expect(result.current.data).toBe("q=a"));
    rerender({ q: "b" });
    await waitFor(() => expect(result.current.data).toBe("q=b"));
  });

  it("reload fetches again, keeps the data on screen while it does, and clears an old error", async () => {
    let n = 0;
    const gates = [deferred(), deferred(), deferred()];
    const { result } = renderHook(() => useAsync(() => gates[n++].promise));
    gates[0].reject(new Error("first failed"));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    let reloading;
    act(() => {
      reloading = result.current.reload();
    });
    expect(result.current).toMatchObject({ loading: true, error: null });
    gates[1].resolve("fine");
    await act(async () => reloading);
    expect(result.current).toMatchObject({ loading: false, error: null, data: "fine" });
    act(() => {
      result.current.reload();
    });
    expect(result.current.data).toBe("fine"); // still shown while reloading
    gates[2].resolve("newer");
    await waitFor(() => expect(result.current.data).toBe("newer"));
  });

  it("setData updates the data locally, with a value or an updater, without another request", async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 });
    const { result } = renderHook(() => useAsync(fetcher));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    act(() => result.current.setData({ n: 2 }));
    expect(result.current.data).toEqual({ n: 2 });
    act(() => result.current.setData((d) => ({ n: d.n + 1 })));
    expect(result.current.data).toEqual({ n: 3 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
