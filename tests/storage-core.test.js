/**
 * Unit Test Suite for storage/storage-core.js
 * Senior QA Engineer & Test Automation Specialist
 * Structure: AAA (Arrange - Act - Assert)
 * Coverage: normalizeGasKeys, databaseManagementUrl, uid uniqueness, isNetworkError, sync status notification
 */

const {
  normalizeGasKeys,
  databaseManagementUrl,
  uid,
  isNetworkError,
  notifySyncStatus,
  _syncListeners,
} = require("../storage/storage-core.js");

describe("storage-core: normalizeGasKeys (Data Normalization)", () => {
  test("Arrange/Act/Assert: normalizes uppercase gas keys to lowercase for database storage", () => {
    // Arrange
    const raw = {
      tram: "Trạm 500kV Pleiku",
      thiet_bi: "AT1",
      H2: 15,
      CH4: 25.5,
      C2H6: 5,
      C2H4: 12,
      C2H2: 0.5,
      CO: 150,
      CO2: 800,
      pha: "A",
    };

    // Act
    const normalized = normalizeGasKeys(raw);

    // Assert
    expect(normalized.h2).toBe(15);
    expect(normalized.ch4).toBe(25.5);
    expect(normalized.c2h6).toBe(5);
    expect(normalized.c2h4).toBe(12);
    expect(normalized.c2h2).toBe(0.5);
    expect(normalized.co).toBe(150);
    expect(normalized.co2).toBe(800);
    // Uppercase keys should be deleted
    expect(normalized.H2).toBeUndefined();
    expect(normalized.CH4).toBeUndefined();
    expect(normalized.CO).toBeUndefined();
    // Non-gas keys remain untouched
    expect(normalized.tram).toBe("Trạm 500kV Pleiku");
    expect(normalized.thiet_bi).toBe("AT1");
    expect(normalized.pha).toBe("A");
  });

  test("Edge case: does not mutate original object (Immutability)", () => {
    // Arrange
    const original = { H2: 10, CH4: 20 };

    // Act
    const normalized = normalizeGasKeys(original);

    // Assert
    expect(original.H2).toBe(10);
    expect(original.h2).toBeUndefined();
    expect(normalized).not.toBe(original);
  });

  test("Edge case: handles objects that already have lowercase keys or missing gases", () => {
    // Arrange
    const alreadyLower = { h2: 10, ch4: 20 };
    const emptyObj = {};

    // Act & Assert
    expect(normalizeGasKeys(alreadyLower)).toEqual({ h2: 10, ch4: 20 });
    expect(normalizeGasKeys(emptyObj)).toEqual({});
  });
});

describe("storage-core: uid (UUID generation & collision resistance)", () => {
  test("generates IDs with expected format 'id_<base36>_<base36>'", () => {
    // Arrange & Act
    const id = uid();

    // Assert
    expect(id).toMatch(/^id_[a-z0-9]+_[a-z0-9]+$/);
  });

  test("Collision resistance: generates 1,000 unique IDs without collision", () => {
    // Arrange
    const count = 1000;
    const set = new Set();

    // Act
    for (let i = 0; i < count; i++) {
      set.add(uid());
    }

    // Assert
    expect(set.size).toBe(count);
  });
});

describe("storage-core: databaseManagementUrl (Admin Link Generator)", () => {
  afterEach(() => {
    delete global.window;
    delete global.Storage;
  });

  test("Gsheet mode: returns GSHEET_SHEET_URL when configured", () => {
    // Arrange
    global.window = {
      DGA_CONFIG: {
        GSHEET_WEBAPP_URL: "https://script.google.com/macros/s/xyz/exec",
        GSHEET_SHEET_URL: "https://docs.google.com/spreadsheets/d/abc123/edit",
      },
    };
    global.Storage = { mode: "gsheet" };

    // Act
    const url = databaseManagementUrl();

    // Assert
    expect(url).toBe("https://docs.google.com/spreadsheets/d/abc123/edit");
  });

  test("Supabase mode: derives project dashboard URL from SUPABASE_URL", () => {
    // Arrange
    global.window = {
      DGA_CONFIG: {
        SUPABASE_URL: "https://abcdefghijk.supabase.co",
        SUPABASE_ANON_KEY: "anon-key",
      },
      supabase: {},
    };
    global.Storage = { mode: "supabase" };

    // Act
    const url = databaseManagementUrl();

    // Assert
    expect(url).toBe("https://supabase.com/dashboard/project/abcdefghijk");
  });

  test("Supabase mode: handles trailing slash in SUPABASE_URL", () => {
    // Arrange
    global.window = {
      DGA_CONFIG: {
        SUPABASE_URL: "https://my-project-ref.supabase.co/",
      },
    };
    global.Storage = { mode: "supabase" };

    // Act
    const url = databaseManagementUrl();

    // Assert
    expect(url).toBe("https://supabase.com/dashboard/project/my-project-ref");
  });

  test("Local mode / unconfigured: returns null", () => {
    // Arrange
    global.window = { DGA_CONFIG: {} };
    global.Storage = { mode: "local" };

    // Act & Assert
    expect(databaseManagementUrl()).toBeNull();
  });
});

describe("storage-core: isNetworkError (Network Failure Detection)", () => {
  afterEach(() => {
    delete global.navigator;
  });

  test("detects offline state when navigator.onLine is false", () => {
    // Arrange
    global.navigator = { onLine: false };

    // Act & Assert
    expect(isNetworkError(new Error("any error"))).toBe(true);
    expect(isNetworkError(null)).toBe(true);
  });

  test("detects common fetch and connection errors", () => {
    // Arrange
    global.navigator = { onLine: true };
    const networkErrors = [
      new Error("Failed to fetch"),
      new Error("NetworkError when attempting to fetch resource."),
      new Error("Connection refused (ERR_CONNECTION_REFUSED)"),
      new Error("getaddrinfo ENOTFOUND script.google.com (DNS failure)"),
      new Error("The operation was aborted due to timeout"),
      new Error("ERR_INTERNET_DISCONNECTED"),
      { message: "Load failed" },
    ];

    // Act & Assert
    networkErrors.forEach((err) => {
      expect(isNetworkError(err)).toBe(true);
    });
  });

  test("returns false for non-network business/validation errors", () => {
    // Arrange
    global.navigator = { onLine: true };
    const businessErrors = [
      new Error("Chưa nhập mật khẩu."),
      new Error("Bản ghi không tồn tại."),
      new Error("Tên trạm đã trùng."),
      new Error("Invalid session token."),
    ];

    // Act & Assert
    businessErrors.forEach((err) => {
      expect(isNetworkError(err)).toBe(false);
    });
  });

  test("Edge case: handles null, undefined, empty errors safely", () => {
    // Arrange
    global.navigator = { onLine: true };

    // Act & Assert
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError("")).toBe(false);
  });
});

describe("storage-core: notifySyncStatus (Event Distribution & Robustness)", () => {
  test("notifies all registered listeners and survives listener errors", () => {
    // Arrange
    const listener1 = jest.fn();
    const throwingListener = jest.fn(() => {
      throw new Error("Crash in listener!");
    });
    const listener2 = jest.fn();

    _syncListeners.push(listener1, throwingListener, listener2);

    // Act
    notifySyncStatus({ online: true, syncing: false });

    // Assert
    expect(listener1).toHaveBeenCalledWith(expect.objectContaining({ online: true, syncing: false }));
    expect(throwingListener).toHaveBeenCalled();
    // Listener 2 MUST still be called even though throwingListener threw an error (Fault tolerance)
    expect(listener2).toHaveBeenCalledWith(expect.objectContaining({ online: true, syncing: false }));

    // Clean up
    _syncListeners.length = 0;
  });
});
