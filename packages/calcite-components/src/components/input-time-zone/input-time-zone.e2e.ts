import { E2EElement, E2EPage, newE2EPage } from "@stencil/core/testing";
import { html } from "../../../support/formatting";
import {
  accessible,
  defaults,
  disabled,
  focusable,
  formAssociated,
  hidden,
  labelable,
  openClose,
  reflects,
  renders,
  t9n,
} from "../../tests/commonTests";
import { TagAndPage } from "../../tests/commonTests/interfaces";
import { DEBOUNCE } from "../../utils/resources";
import { getCity, toUserFriendlyName } from "./utils";

/*
 * **Notes**
 *
 * - tests need to have an emulated time zone
 * - test time zones should preferably be unaffected by daylight savings time, see https://en.wikipedia.org/wiki/List_of_tz_database_time_zones for more info
 * - not all time zones are supported in Puppeteer's bundled Chromium, so we patch the Intl API with test-specific values/logic
 */

describe("calcite-input-time-zone", () => {
  type TestTimeZoneItem = {
    name: string;
    offset: number;
    label: string;
  };

  // for stability, we use time zones that are unaffected by daylight savings time
  const testTimeZoneItems: TestTimeZoneItem[] = [
    { name: "America/Mexico_City", offset: -360, label: "GMT-6" },
    { name: "America/Phoenix", offset: -420, label: "GMT-7" },
    { name: "Pacific/Guam", offset: 600, label: "GMT+10" },
    { name: "Pacific/Galapagos", offset: -360, label: "GMT-6" },
  ];

  async function simpleTestProvider(): Promise<TagAndPage> {
    const page = await newE2EPage();
    await page.emulateTimezone(testTimeZoneItems[0].name);
    await page.setContent(overrideSupportedTimeZones(html`<calcite-input-time-zone></calcite-input-time-zone>`));

    return {
      page,
      tag: "calcite-input-time-zone",
    };
  }

  describe("accessible", () => {
    accessible(simpleTestProvider);
  });

  describe("focusable", () => {
    focusable(simpleTestProvider);
  });

  describe("formAssociated", () => {
    formAssociated(
      {
        tagOrHTML: overrideSupportedTimeZones(html`<calcite-input-time-zone></calcite-input-time-zone>`),
        beforeContent: async (page) => {
          await page.emulateTimezone(testTimeZoneItems[0].name);
        },
      },
      {
        testValue: "-360",
        clearable: false,
      },
    );
  });

  describe("hidden", () => {
    hidden(simpleTestProvider);
  });

  describe("renders", () => {
    renders(simpleTestProvider, { display: "block" });
  });

  describe("labelable", () => {
    labelable({
      tagOrHTML: overrideSupportedTimeZones(html`<calcite-input-time-zone></calcite-input-time-zone>`),
      beforeContent: async (page) => {
        await page.emulateTimezone(testTimeZoneItems[0].name);
      },
    });
  });

  describe("reflects", () => {
    reflects(simpleTestProvider, [
      { propertyName: "disabled", value: true },
      { propertyName: "maxItems", value: 0 },
      { propertyName: "mode", value: "offset" },
      { propertyName: "open", value: true },
      { propertyName: "scale", value: "m" },
      { propertyName: "overlayPositioning", value: "absolute" },
      { propertyName: "status", value: "invalid" },
      { propertyName: "validationIcon", value: true },
    ]);
  });

  describe("defaults", () => {
    defaults(simpleTestProvider, [
      { propertyName: "disabled", defaultValue: false },
      { propertyName: "maxItems", defaultValue: 0 },
      { propertyName: "messageOverrides", defaultValue: undefined },
      { propertyName: "mode", defaultValue: "offset" },
      { propertyName: "open", defaultValue: false },
      { propertyName: "overlayPositioning", defaultValue: "absolute" },
      { propertyName: "scale", defaultValue: "m" },
      { propertyName: "status", defaultValue: "idle" },
      { propertyName: "validationIcon", defaultValue: undefined },
      { propertyName: "validationMessage", defaultValue: undefined },
    ]);
  });

  describe("disabled", () => {
    disabled(simpleTestProvider, {
      shadowAriaAttributeTargetSelector: "calcite-combobox",
    });
  });

  describe("t9n", () => {
    t9n(simpleTestProvider);
  });

  describe("openClose", () => {
    openClose(simpleTestProvider);

    describe("initially open", () => {
      openClose.initial("calcite-input-time-zone", {
        beforeContent: async (page) => {
          await page.emulateTimezone(testTimeZoneItems[0].name);

          // we add the override script this way because `setContent` was already used before this hook, and calling it again will result in an error.
          await page.evaluate(
            (supportedTimeZoneOverrideHtml) =>
              document.body.insertAdjacentHTML("beforeend", supportedTimeZoneOverrideHtml),
            overrideSupportedTimeZones(""),
          );

          await page.waitForChanges();
        },
      });
    });
  });

  describe("mode", () => {
    describe("offset (default)", () => {
      describe("selects user's matching time zone offset on initialization", () => {
        testTimeZoneItems.forEach(({ name, offset, label }) => {
          it(`selects default time zone for "${name}"`, async () => {
            const page = await newE2EPage();
            await page.emulateTimezone(name);
            await page.setContent(
              overrideSupportedTimeZones(html`<calcite-input-time-zone></calcite-input-time-zone>`),
            );
            await page.waitForChanges();

            const input = await page.find("calcite-input-time-zone");
            expect(await input.getProperty("value")).toBe(`${offset}`);

            const timeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");

            expect(await timeZoneItem.getProperty("textLabel")).toMatch(label);
          });
        });
      });

      it("allows users to preselect a time zone offset", async () => {
        const page = await newE2EPage();
        await page.emulateTimezone(testTimeZoneItems[0].name);
        await page.setContent(
          overrideSupportedTimeZones(
            html`<calcite-input-time-zone value="${testTimeZoneItems[1].offset}"></calcite-input-time-zone>`,
          ),
        );

        const input = await page.find("calcite-input-time-zone");

        expect(await input.getProperty("value")).toBe(`${testTimeZoneItems[1].offset}`);

        const timeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");

        expect(await timeZoneItem.getProperty("textLabel")).toMatch(testTimeZoneItems[1].label);
      });

      it("ignores invalid values", async () => {
        const page = await newE2EPage();
        await page.emulateTimezone(testTimeZoneItems[0].name);
        await page.setContent(
          overrideSupportedTimeZones(html`<calcite-input-time-zone value="9000"></calcite-input-time-zone>`),
        );

        const input = await page.find("calcite-input-time-zone");

        expect(await input.getProperty("value")).toBe(`${testTimeZoneItems[0].offset}`);

        const timeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");

        expect(await timeZoneItem.getProperty("textLabel")).toMatch(testTimeZoneItems[0].label);
      });

      it("omits filtered or non-localized time zones (incoming to browser)", async () => {
        const page = await newE2EPage();
        await page.emulateTimezone(testTimeZoneItems[0].name);
        await page.setContent(
          await overrideSupportedTimeZones(html`<calcite-input-time-zone value="600"></calcite-input-time-zone>`),
        );

        const input = await page.find("calcite-input-time-zone");

        expect(await input.getProperty("value")).toBe(`${testTimeZoneItems[2].offset}`);

        const timeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");

        expect(await timeZoneItem.getProperty("textLabel")).toMatch(testTimeZoneItems[2].label);
      });

      it("looks up in label and time zone groups (not displayed)", async () => {
        const displayLabelSearchTerm = "Guam";
        const groupedTimeZoneSearchTerm = "Chuuk";
        const gmtSearchTerm = "GMT-12";
        const searchTerms = [displayLabelSearchTerm, groupedTimeZoneSearchTerm, gmtSearchTerm];

        const page = await newE2EPage();
        await page.emulateTimezone(testTimeZoneItems[0].name);
        await page.setContent(
          await overrideSupportedTimeZones(html`<calcite-input-time-zone></calcite-input-time-zone>`),
        );

        const input = await page.find("calcite-input-time-zone");

        async function clearSearchTerm(searchTerm: string): Promise<void> {
          for (let i = 0; i < searchTerm.length; i++) {
            await input.press("Backspace");
          }
        }

        let matchedTimeZoneItems = await page.findAll(
          "calcite-input-time-zone >>> calcite-combobox-item:not([hidden])",
        );
        expect(matchedTimeZoneItems.length).toBeGreaterThan(1);

        await input.click();
        await input.type(searchTerms[0]);
        await page.waitForChanges();
        await page.waitForTimeout(DEBOUNCE.filter);

        matchedTimeZoneItems = await page.findAll("calcite-input-time-zone >>> calcite-combobox-item:not([hidden])");

        expect(matchedTimeZoneItems).toHaveLength(1);

        await clearSearchTerm(searchTerms[0]);
        await input.type(searchTerms[1]);
        await page.waitForChanges();
        await page.waitForTimeout(DEBOUNCE.filter);

        matchedTimeZoneItems = await page.findAll("calcite-input-time-zone >>> calcite-combobox-item:not([hidden])");

        expect(matchedTimeZoneItems).toHaveLength(1);

        await clearSearchTerm(searchTerms[1]);
        await input.type(searchTerms[2]);
        await page.waitForChanges();
        await page.waitForTimeout(DEBOUNCE.filter);

        matchedTimeZoneItems = await page.findAll("calcite-input-time-zone >>> calcite-combobox-item:not([hidden])");

        expect(matchedTimeZoneItems).toHaveLength(2);

        await clearSearchTerm(searchTerms[1]);
        await page.waitForChanges();
        await page.waitForTimeout(DEBOUNCE.filter);

        matchedTimeZoneItems = await page.findAll("calcite-input-time-zone >>> calcite-combobox-item:not([hidden])");

        expect(matchedTimeZoneItems.length).toBeGreaterThan(1);
      });
    });

    describe("name", () => {
      describe("selects user's matching time zone name on initialization", () => {
        testTimeZoneItems.forEach(({ name }) => {
          it(`selects default time zone for "${name}"`, async () => {
            const page = await newE2EPage();
            await page.emulateTimezone(name);
            await page.setContent(
              await overrideSupportedTimeZones(html`<calcite-input-time-zone mode="name"></calcite-input-time-zone>`),
            );
            await page.waitForChanges();

            const input = await page.find("calcite-input-time-zone");
            expect(await input.getProperty("value")).toBe(name);

            const timeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");

            expect(await timeZoneItem.getProperty("textLabel")).toMatch(toUserFriendlyName(name));
          });
        });
      });

      it("allows users to preselect a time zone by name", async () => {
        const page = await newE2EPage();
        await page.emulateTimezone(testTimeZoneItems[0].name);
        await page.setContent(
          await overrideSupportedTimeZones(
            html`<calcite-input-time-zone mode="name" value="${testTimeZoneItems[1].name}"></calcite-input-time-zone>`,
          ),
        );

        const input = await page.find("calcite-input-time-zone");

        expect(await input.getProperty("value")).toBe(testTimeZoneItems[1].name);

        const timeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");

        expect(await timeZoneItem.getProperty("textLabel")).toMatch(toUserFriendlyName(testTimeZoneItems[1].name));
      });

      it("ignores invalid values", async () => {
        const page = await newE2EPage();
        await page.emulateTimezone(testTimeZoneItems[0].name);
        await page.setContent(
          await overrideSupportedTimeZones(
            html`<calcite-input-time-zone mode="name" value="Does/Not/Exist"></calcite-input-time-zone>`,
          ),
        );

        const input = await page.find("calcite-input-time-zone");

        expect(await input.getProperty("value")).toBe(testTimeZoneItems[0].name);

        const timeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");

        expect(await timeZoneItem.getProperty("textLabel")).toMatch(toUserFriendlyName(testTimeZoneItems[0].name));
      });
    });

    describe("region", () => {
      describe("selects user's matching time zone name on initialization", () => {
        testTimeZoneItems.forEach(({ name }) => {
          it(`selects default time zone for "${name}"`, async () => {
            const page = await newE2EPage();
            await page.emulateTimezone(name);
            await page.setContent(
              await overrideSupportedTimeZones(html`<calcite-input-time-zone mode="region"></calcite-input-time-zone>`),
            );
            await page.waitForChanges();

            const input = await page.find("calcite-input-time-zone");
            expect(await input.getProperty("value")).toBe(name);

            const timeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");

            expect(await timeZoneItem.getProperty("textLabel")).toMatch(toUserFriendlyName(getCity(name)));
          });
        });
      });

      it("allows users to preselect a time zone by name", async () => {
        const page = await newE2EPage();
        await page.emulateTimezone(testTimeZoneItems[0].name);
        await page.setContent(
          await overrideSupportedTimeZones(
            html`<calcite-input-time-zone
              mode="region"
              value="${testTimeZoneItems[1].name}"
            ></calcite-input-time-zone>`,
          ),
        );

        const input = await page.find("calcite-input-time-zone");

        expect(await input.getProperty("value")).toBe(testTimeZoneItems[1].name);

        const timeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");

        expect(await timeZoneItem.getProperty("textLabel")).toMatch(
          toUserFriendlyName(getCity(testTimeZoneItems[1].name)),
        );
      });

      it("ignores invalid values", async () => {
        const page = await newE2EPage();
        await page.emulateTimezone(testTimeZoneItems[0].name);
        await page.setContent(
          await overrideSupportedTimeZones(
            html`<calcite-input-time-zone mode="region" value="Does/Not/Exist"></calcite-input-time-zone>`,
          ),
        );

        const input = await page.find("calcite-input-time-zone");

        expect(await input.getProperty("value")).toBe(testTimeZoneItems[0].name);

        const timeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");

        expect(await timeZoneItem.getProperty("textLabel")).toMatch(
          toUserFriendlyName(getCity(testTimeZoneItems[0].name)),
        );
      });
    });
  });

  describe("clearable", () => {
    it("does not allow users to deselect a time zone value by default", async () => {
      const page = await newE2EPage();
      await page.emulateTimezone(testTimeZoneItems[0].name);
      await page.setContent(
        overrideSupportedTimeZones(html`
          <calcite-input-time-zone value="${testTimeZoneItems[1].offset}" open></calcite-input-time-zone>
        `),
      );
      await page.waitForChanges();

      let selectedTimeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");
      await selectedTimeZoneItem.click();
      await page.waitForChanges();

      selectedTimeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");
      const input = await page.find("calcite-input-time-zone");

      expect(await input.getProperty("value")).toBe(`${testTimeZoneItems[1].offset}`);
      expect(await selectedTimeZoneItem.getProperty("textLabel")).toMatch(testTimeZoneItems[1].label);

      input.setProperty("value", "");
      await page.waitForChanges();

      selectedTimeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");
      expect(await input.getProperty("value")).toBe(`${testTimeZoneItems[1].offset}`);
      expect(await selectedTimeZoneItem.getProperty("textLabel")).toMatch(testTimeZoneItems[1].label);
    });

    describe("clearing by value", () => {
      let page: E2EPage;
      let input: E2EElement;

      beforeEach(async () => {
        page = await newE2EPage();
        await page.emulateTimezone(testTimeZoneItems[0].name);
        await page.setContent(
          overrideSupportedTimeZones(
            html` <calcite-input-time-zone value="${testTimeZoneItems[1].offset}" clearable></calcite-input-time-zone>`,
          ),
        );
        input = await page.find("calcite-input-time-zone");
      });

      it("empty string", async () => {
        await input.setProperty("value", "");
        await page.waitForChanges();

        expect(await input.getProperty("value")).toBe("");
      });

      it("null", async () => {
        await input.setProperty("value", null);
        await page.waitForChanges();

        expect(await input.getProperty("value")).toBe("");
      });
    });

    it("allows users to deselect a time zone value when clearable is enabled", async () => {
      const page = await newE2EPage();
      await page.emulateTimezone(testTimeZoneItems[0].name);
      await page.setContent(
        overrideSupportedTimeZones(
          html`<calcite-input-time-zone value="${testTimeZoneItems[1].offset}" clearable></calcite-input-time-zone>`,
        ),
      );

      const input = await page.find("calcite-input-time-zone");
      await input.callMethod("setFocus");

      expect(await input.getProperty("value")).toBe(`${testTimeZoneItems[1].offset}`);

      await input.press("Escape");
      await page.waitForChanges();

      expect(await input.getProperty("value")).toBe("");
    });

    it("can be cleared on initialization when clearable is enabled", async () => {
      const page = await newE2EPage();
      await page.emulateTimezone(testTimeZoneItems[0].name);
      await page.setContent(
        overrideSupportedTimeZones(html`<calcite-input-time-zone value="" clearable></calcite-input-time-zone>`),
      );

      const input = await page.find("calcite-input-time-zone");
      expect(await input.getProperty("value")).toBe("");
    });

    it("selects user time zone value when value is not set and clearable is enabled", async () => {
      const page = await newE2EPage();
      await page.emulateTimezone(testTimeZoneItems[0].name);
      await page.setContent(
        overrideSupportedTimeZones(html`<calcite-input-time-zone clearable></calcite-input-time-zone>`),
      );

      const input = await page.find("calcite-input-time-zone");
      expect(await input.getProperty("value")).toBe(`${testTimeZoneItems[0].offset}`);
    });
  });

  describe("selection of subsequent items with the same offset", () => {
    const testCases: {
      name: string;
      initialTimeZoneItem: TestTimeZoneItem;
    }[] = [
      {
        name: "displays selected item when changing from another offset",
        initialTimeZoneItem: testTimeZoneItems[1],
      },
      {
        name: "displays selected item when changing from the same offset",
        initialTimeZoneItem: testTimeZoneItems[0],
      },
    ];

    testCases.forEach(({ name, initialTimeZoneItem }) => {
      it(`${name}`, async () => {
        const page = await newE2EPage();
        await page.emulateTimezone(initialTimeZoneItem.name);
        await page.setContent(
          overrideSupportedTimeZones(
            html`<calcite-input-time-zone value="${initialTimeZoneItem.offset}"></calcite-input-time-zone> `,
          ),
        );

        const input = await page.find("calcite-input-time-zone");
        await input.click();
        await page.waitForChanges();
        await input.type("(GMT-6)");
        await page.waitForChanges();
        await page.waitForTimeout(DEBOUNCE.filter);

        const sharedOffsetTimeZoneItems = await page.findAll(
          "calcite-input-time-zone >>> calcite-combobox-item:not([hidden])",
        );
        expect(sharedOffsetTimeZoneItems).toHaveLength(2);

        await sharedOffsetTimeZoneItems[1].click();
        await page.waitForChanges();
        await page.waitForTimeout(DEBOUNCE.filter);

        const selectedTimeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item[selected]");
        const expectedTimeZoneItem = testTimeZoneItems[3];

        expect(await input.getProperty("value")).toBe(`${expectedTimeZoneItem.offset}`);
        expect(await selectedTimeZoneItem.getProperty("value")).toMatch(expectedTimeZoneItem.name);
      });
    });
  });

  it("supports setting maxItems to display", async () => {
    const page = await newE2EPage();
    await page.emulateTimezone(testTimeZoneItems[0].name);
    await page.setContent(
      overrideSupportedTimeZones(html`<calcite-input-time-zone max-items="7"></calcite-input-time-zone>`),
    );
    const internalCombobox = await page.find("calcite-input-time-zone >>> calcite-combobox");

    // we assume maxItems works properly on combobox
    expect(await internalCombobox.getProperty("maxItems")).toBe(7);
  });

  it("recreates time zone items when item-dependent props change", async () => {
    const page = await newE2EPage();
    await page.emulateTimezone(testTimeZoneItems[0].name);
    await page.setContent(overrideSupportedTimeZones(html`<calcite-input-time-zone></calcite-input-time-zone>`));
    const inputTimeZone = await page.find("calcite-input-time-zone");

    let prevComboboxItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item");
    inputTimeZone.setProperty("lang", "es");
    await page.waitForChanges();

    let currComboboxItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item");
    expect(currComboboxItem).not.toBe(prevComboboxItem);

    prevComboboxItem = currComboboxItem;
    inputTimeZone.setProperty("referenceDate", "2021-01-01");
    await page.waitForChanges();

    currComboboxItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item");
    expect(currComboboxItem).not.toBe(prevComboboxItem);

    prevComboboxItem = currComboboxItem;
    inputTimeZone.setProperty("mode", "list");
    await page.waitForChanges();

    currComboboxItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item");
    expect(currComboboxItem).not.toBe(prevComboboxItem);
  });

  describe("offsetStyle", () => {
    const gmtTimeZoneLocale = "en-GB";
    const utcTimeZoneLocale = "fr";

    let page: E2EPage;

    async function assertItemLabelMatches(page: E2EPage, offsetMarker: "GMT" | "UTC"): Promise<void> {
      // all items are formatted equally, so we only need to check the first one
      const firstTimeZoneItem = await page.find("calcite-input-time-zone >>> calcite-combobox-item");

      expect(await firstTimeZoneItem.getProperty("textLabel")).toContain(offsetMarker);
    }

    beforeEach(async () => {
      page = await newE2EPage();
      await page.emulateTimezone(testTimeZoneItems[0].name);
    });

    describe("displays UTC or GMT based on user's locale (default)", () => {
      it("displays GMT for GMT-preferred locale", async () => {
        await page.setContent(
          overrideSupportedTimeZones(
            html`<calcite-input-time-zone lang="${gmtTimeZoneLocale}"></calcite-input-time-zone>`,
          ),
        );

        await assertItemLabelMatches(page, "GMT");
      });

      it("displays UTC for UTC-preferred locale", async () => {
        await page.setContent(
          overrideSupportedTimeZones(
            html`<calcite-input-time-zone lang="${utcTimeZoneLocale}"></calcite-input-time-zone>`,
          ),
        );

        await assertItemLabelMatches(page, "UTC");
      });
    });

    it("supports GMT as a style", async () => {
      await page.setContent(
        overrideSupportedTimeZones(
          html`<calcite-input-time-zone lang="${utcTimeZoneLocale}" offset-style="gmt"></calcite-input-time-zone>`,
        ),
      );

      await assertItemLabelMatches(page, "GMT");
    });

    it("supports UTC as a style", async () => {
      await page.setContent(
        overrideSupportedTimeZones(
          html`<calcite-input-time-zone lang="${gmtTimeZoneLocale}" offset-style="utc"></calcite-input-time-zone>`,
        ),
      );

      await assertItemLabelMatches(page, "UTC");
    });
  });
});

/**
 * This helper overrides supported time zones for testing purposes
 *
 * @param testHtml
 */
function overrideSupportedTimeZones(testHtml: string): string {
  return html`<script type="module">
      Intl.supportedValuesOf = function (key) {
        if (key === "timeZone") {
          return [
            "America/Mexico_City",
            "America/Phoenix",
            "Pacific/Galapagos",
            "Pacific/Guam",

            // not available in Chromium v119 at time of testing
            "Etc/GMT+1",
            "Etc/GMT+10",
            "Etc/GMT+11",
            "Etc/GMT+12",
            "Etc/GMT+2",
            "Etc/GMT+3",
            "Etc/GMT+4",
            "Etc/GMT+5",
            "Etc/GMT+6",
            "Etc/GMT+7",
            "Etc/GMT+8",
            "Etc/GMT+9",
            "Etc/GMT-1",
            "Etc/GMT-10",
            "Etc/GMT-11",
            "Etc/GMT-12",
            "Etc/GMT-13",
            "Etc/GMT-14",
            "Etc/GMT-2",
            "Etc/GMT-3",
            "Etc/GMT-4",
            "Etc/GMT-5",
            "Etc/GMT-6",
            "Etc/GMT-7",
            "Etc/GMT-8",
            "Etc/GMT-9",
            "Pacific/Chuuk",
          ];
        }
      };
    </script>
    ${testHtml}`;
}
