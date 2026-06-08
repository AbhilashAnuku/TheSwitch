/**
 * Tests for the floating control widget.
 *
 * The widget mounts a custom `<the-switch-widget>` host into `document.body` and
 * renders its entire UI inside that host's Shadow DOM, so a host page can never
 * leak styles in or out. Its Auto / Light / Dark radios invoke `onMode`, and the
 * live-weather toggle is OFF by default (privacy-first: no geolocation prompt
 * until the visitor explicitly opts in via `onLiveWeather`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWidget } from "./widget";
import type { WidgetDeps, WidgetHandle } from "./widget";

const HOST_TAG = "the-switch-widget";

let widget: WidgetHandle | undefined;

afterEach(() => {
  widget?.destroy();
  widget = undefined;
  // Remove any stray hosts the widget mounted into the body.
  for (const el of Array.from(document.body.querySelectorAll(HOST_TAG))) {
    el.remove();
  }
  vi.restoreAllMocks();
});

/** Build the real WidgetDeps the engine constructs, with overridable callbacks. */
function makeDeps(overrides: Partial<WidgetDeps> = {}): WidgetDeps {
  return {
    currentSkin: "light",
    currentMode: "auto",
    liveWeather: false,
    onMode: vi.fn(),
    onLiveWeather: vi.fn(),
    ...overrides,
  };
}

/** The host element the widget mounted into the document body. */
function mountedHost(): HTMLElement {
  const host = document.body.querySelector<HTMLElement>(HOST_TAG);
  if (!host) throw new Error(`widget host <${HOST_TAG}> not mounted`);
  return host;
}

/** The widget's isolated shadow root. */
function shadowRoot(): ShadowRoot {
  const root = mountedHost().shadowRoot;
  if (!root) throw new Error("widget host has no shadow root");
  return root;
}

/** Find a mode radio inside the shadow root by its (case-insensitive) label. */
function modeButton(root: ShadowRoot, label: string): HTMLButtonElement {
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('button[role="radio"]'),
  );
  const wanted = label.toLowerCase();
  const match = buttons.find((b) => {
    const text = (b.textContent ?? "").trim().toLowerCase();
    const aria = (b.getAttribute("aria-label") ?? "").toLowerCase();
    return text === wanted || aria.includes(wanted);
  });
  if (!match) throw new Error(`mode button "${label}" not found in widget`);
  return match;
}

/** The live-weather opt-in switch. */
function liveSwitch(root: ShadowRoot): HTMLButtonElement {
  const sw = root.querySelector<HTMLButtonElement>('button[role="switch"]');
  if (!sw) throw new Error("live-weather switch not found in widget");
  return sw;
}

describe("createWidget — Shadow DOM isolation", () => {
  it("renders its UI inside a shadow root on the mounted host", () => {
    widget = createWidget(makeDeps());

    const host = mountedHost();
    expect(host.shadowRoot).not.toBeNull();
    const root = host.shadowRoot as ShadowRoot;
    // Some content was rendered into the isolated tree.
    expect(root.childElementCount).toBeGreaterThan(0);
    // The host element itself stays free of injected light-DOM children.
    expect(host.children.length).toBe(0);
  });

  it("exposes an accessible, labelled control surface", () => {
    widget = createWidget(makeDeps());
    const root = shadowRoot();

    const buttons = root.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of Array.from(buttons)) {
      const labelled =
        (btn.textContent ?? "").trim() !== "" ||
        btn.hasAttribute("aria-label") ||
        btn.hasAttribute("aria-labelledby") ||
        btn.hasAttribute("title");
      expect(labelled).toBe(true);
    }
  });

  it("renders the current skin's label", () => {
    widget = createWidget(makeDeps({ currentSkin: "stormy" }));
    const root = shadowRoot();

    const label = root.querySelector<HTMLElement>(".label");
    expect(label?.textContent).toBe("Storm");
  });
});

describe("createWidget — mode radios", () => {
  it("invokes onMode with 'light' when the Light radio is pressed", () => {
    const onMode = vi.fn();
    widget = createWidget(makeDeps({ onMode }));
    const root = shadowRoot();

    modeButton(root, "light").click();

    expect(onMode).toHaveBeenCalledWith("light");
  });

  it("invokes onMode with 'dark' when the Dark radio is pressed", () => {
    const onMode = vi.fn();
    widget = createWidget(makeDeps({ onMode }));
    const root = shadowRoot();

    modeButton(root, "dark").click();

    expect(onMode).toHaveBeenCalledWith("dark");
  });

  it("invokes onMode with 'auto' when the Auto radio is pressed", () => {
    const onMode = vi.fn();
    widget = createWidget(makeDeps({ onMode }));
    const root = shadowRoot();

    modeButton(root, "auto").click();

    expect(onMode).toHaveBeenCalledWith("auto");
  });

  it("marks the initially-selected mode as checked", () => {
    widget = createWidget(makeDeps({ currentMode: "dark" }));
    const root = shadowRoot();

    expect(modeButton(root, "dark").getAttribute("aria-checked")).toBe("true");
    expect(modeButton(root, "light").getAttribute("aria-checked")).toBe("false");
  });
});

describe("createWidget — live-weather toggle", () => {
  it("defaults the live-weather toggle to off", () => {
    widget = createWidget(makeDeps({ liveWeather: false }));
    const root = shadowRoot();

    expect(liveSwitch(root).getAttribute("aria-checked")).toBe("false");
  });

  it("invokes onLiveWeather(true) when the visitor opts in", () => {
    const onLiveWeather = vi.fn();
    widget = createWidget(makeDeps({ liveWeather: false, onLiveWeather }));
    const root = shadowRoot();

    liveSwitch(root).click();

    expect(onLiveWeather).toHaveBeenCalledWith(true);
    expect(liveSwitch(root).getAttribute("aria-checked")).toBe("true");
  });
});

describe("createWidget — handle", () => {
  it("reflects setMode on the handle without re-notifying onMode", () => {
    const onMode = vi.fn();
    widget = createWidget(makeDeps({ currentMode: "auto", onMode }));
    const root = shadowRoot();

    widget.setMode("light");

    expect(modeButton(root, "light").getAttribute("aria-checked")).toBe("true");
    expect(onMode).not.toHaveBeenCalled();
  });

  it("updates the displayed skin via setSkin", () => {
    widget = createWidget(makeDeps({ currentSkin: "light" }));
    const root = shadowRoot();

    widget.setSkin("night");

    expect(root.querySelector<HTMLElement>(".label")?.textContent).toBe(
      "Night",
    );
  });

  it("removes its host on destroy", () => {
    widget = createWidget(makeDeps());
    expect(document.body.querySelector(HOST_TAG)).not.toBeNull();

    widget.destroy();
    widget = undefined;

    expect(document.body.querySelector(HOST_TAG)).toBeNull();
  });
});
