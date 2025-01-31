import {
  Component,
  Element,
  Event,
  EventEmitter,
  h,
  Host,
  Method,
  Prop,
  State,
  VNode,
  Watch,
} from "@stencil/core";
import {
  focusFirstTabbable,
  slotChangeGetAssignedElements,
  slotChangeHasAssignedElement,
  toAriaBoolean,
} from "../../utils/dom";
import {
  InteractiveComponent,
  InteractiveContainer,
  updateHostInteraction,
} from "../../utils/interactive";
import {
  componentFocusable,
  LoadableComponent,
  setComponentLoaded,
  setUpLoadableComponent,
} from "../../utils/loadable";
import { createObserver } from "../../utils/observers";
import { SLOTS as ACTION_MENU_SLOTS } from "../action-menu/resources";
import { Heading, HeadingLevel } from "../functional/Heading";
import { connectLocalized, disconnectLocalized, LocalizedComponent } from "../../utils/locale";
import {
  connectMessages,
  disconnectMessages,
  setUpMessages,
  T9nComponent,
  updateMessages,
} from "../../utils/t9n";
import { OverlayPositioning } from "../../utils/floating-ui";
import { CollapseDirection } from "../interfaces";
import { Scale } from "../interfaces";
import { PanelMessages } from "./assets/panel/t9n";
import { CSS, ICONS, IDS, SLOTS } from "./resources";

/**
 * @slot - A slot for adding custom content.
 * @slot action-bar - A slot for adding a `calcite-action-bar` to the component.
 * @slot alerts - A slot for adding `calcite-alert`s to the component.
 * @slot content-bottom - A slot for adding content below the unnamed (default) slot and above the footer slot (if populated)
 * @slot content-top - A slot for adding content above the unnamed (default) slot and below the action-bar slot (if populated).
 * @slot header-actions-start - A slot for adding actions or content to the start side of the header.
 * @slot header-actions-end - A slot for adding actions or content to the end side of the header.
 * @slot header-content - A slot for adding custom content to the header.
 * @slot header-menu-actions - A slot for adding an overflow menu with actions inside a `calcite-dropdown`.
 * @slot fab - A slot for adding a `calcite-fab` (floating action button) to perform an action.
 * @slot footer - A slot for adding custom content to the component's footer. Should not be used with the `"footer-start"` or `"footer-end"` slots.
 * @slot footer-actions - [Deprecated] Use the `footer-start` and `footer-end` slots instead. A slot for adding `calcite-button`s to the component's footer.
 * @slot footer-end - A slot for adding a trailing footer custom content. Should not be used with the `"footer"` slot.
 * @slot footer-start - A slot for adding a leading footer custom content. Should not be used with the `"footer"` slot.
 */
@Component({
  tag: "calcite-panel",
  styleUrl: "panel.scss",
  shadow: true,
  assetsDirs: ["assets"],
})
export class Panel
  implements InteractiveComponent, LoadableComponent, LocalizedComponent, T9nComponent
{
  // --------------------------------------------------------------------------
  //
  //  Properties
  //
  // --------------------------------------------------------------------------

  /** Passes a function to run before the component closes. */
  @Prop() beforeClose: () => Promise<void>;

  /** When `true`, the component will be hidden. */
  @Prop({ mutable: true, reflect: true }) closed = false;

  @Watch("closed")
  toggleDialog(value: boolean): void {
    value ? this.close() : this.open();
  }

  /**
   *  When `true`, interaction is prevented and the component is displayed with lower opacity.
   */
  @Prop({ reflect: true }) disabled = false;

  /** When `true`, displays a close button in the trailing side of the header. */
  @Prop({ reflect: true }) closable = false;

  /**
   * When `true`, hides the component's content area.
   */
  @Prop({ reflect: true }) collapsed = false;

  /**
   * Specifies the direction of the collapse.
   *
   * @internal
   */
  @Prop() collapseDirection: CollapseDirection = "down";

  /**
   * When `true`, the component is collapsible.
   */
  @Prop({ reflect: true }) collapsible = false;

  /**
   * Specifies the heading level of the component's `heading` for proper document structure, without affecting visual styling.
   */
  @Prop({ reflect: true }) headingLevel: HeadingLevel;

  /**
   * When `true`, a busy indicator is displayed.
   */
  @Prop({ reflect: true }) loading = false;

  /**
   * The component header text.
   */
  @Prop() heading: string;

  /** A description for the component. */
  @Prop() description: string;

  /**
   * When `true`, the action menu items in the `header-menu-actions` slot are open.
   */
  @Prop({ reflect: true }) menuOpen = false;

  /**
   * Use this property to override individual strings used by the component.
   */
  // eslint-disable-next-line @stencil-community/strict-mutable -- updated by t9n module
  @Prop({ mutable: true }) messageOverrides: Partial<PanelMessages>;

  /**
   * Made into a prop for testing purposes only
   *
   * @internal
   */
  // eslint-disable-next-line @stencil-community/strict-mutable -- updated by t9n module
  @Prop({ mutable: true }) messages: PanelMessages;

  @Watch("messageOverrides")
  onMessagesChange(): void {
    /* wired up by t9n util */
  }

  /**
   * Determines the type of positioning to use for the overlaid content.
   *
   * Using `"absolute"` will work for most cases. The component will be positioned inside of overflowing parent containers and will affect the container's layout.
   *
   * `"fixed"` should be used to escape an overflowing parent container, or when the reference element's `position` CSS property is `"fixed"`.
   *
   */
  @Prop({ reflect: true }) overlayPositioning: OverlayPositioning = "absolute";

  /** Specifies the size of the component. */
  @Prop({ reflect: true }) scale: Scale = "m";

  //--------------------------------------------------------------------------
  //
  //  Lifecycle
  //
  //--------------------------------------------------------------------------

  connectedCallback(): void {
    connectLocalized(this);
    connectMessages(this);
  }

  async componentWillLoad(): Promise<void> {
    setUpLoadableComponent(this);
    await setUpMessages(this);
  }

  componentDidLoad(): void {
    setComponentLoaded(this);
  }

  componentDidRender(): void {
    updateHostInteraction(this);
  }

  disconnectedCallback(): void {
    disconnectLocalized(this);
    disconnectMessages(this);
    this.resizeObserver?.disconnect();
  }

  // --------------------------------------------------------------------------
  //
  //  Private Properties
  //
  // --------------------------------------------------------------------------

  @Element() el: HTMLCalcitePanelElement;

  containerEl: HTMLElement;

  panelScrollEl: HTMLElement;

  resizeObserver = createObserver("resize", () => this.resizeHandler());

  @State() isClosed = false;

  @State() hasStartActions = false;

  @State() hasEndActions = false;

  @State() hasMenuItems = false;

  @State() hasHeaderContent = false;

  @State() hasActionBar = false;

  @State() hasContentBottom = false;

  @State() hasContentTop = false;

  @State() hasFab = false;

  @State() hasFooterActions = false;

  @State() hasFooterContent = false;

  @State() hasFooterEndContent = false;

  @State() hasFooterStartContent = false;

  @State() defaultMessages: PanelMessages;

  @State() effectiveLocale = "";

  @State() showHeaderContent = false;

  @Watch("effectiveLocale")
  effectiveLocaleChange(): void {
    updateMessages(this, this.effectiveLocale);
  }

  // --------------------------------------------------------------------------
  //
  //  Events
  //
  // --------------------------------------------------------------------------

  /**
   * Fires when the close button is clicked.
   */
  @Event({ cancelable: false }) calcitePanelClose: EventEmitter<void>;

  /**
   * Fires when the collapse button is clicked.
   */
  @Event({ cancelable: false }) calcitePanelToggle: EventEmitter<void>;

  /**
   * Fires when the content is scrolled.
   */
  @Event({ cancelable: false }) calcitePanelScroll: EventEmitter<void>;

  // --------------------------------------------------------------------------
  //
  //  Private Methods
  //
  // --------------------------------------------------------------------------

  resizeHandler = (): void => {
    const { panelScrollEl } = this;

    if (
      !panelScrollEl ||
      typeof panelScrollEl.scrollHeight !== "number" ||
      typeof panelScrollEl.offsetHeight !== "number"
    ) {
      return;
    }

    const hasScrollingContent = panelScrollEl.scrollHeight > panelScrollEl.offsetHeight;

    // intentionally using setAttribute to avoid reflecting -1 so default browser behavior will occur
    if (hasScrollingContent) {
      panelScrollEl.setAttribute("tabindex", "0");
    } else {
      panelScrollEl.removeAttribute("tabindex");
    }
  };

  setContainerRef = (node: HTMLElement): void => {
    this.containerEl = node;
  };

  panelKeyDownHandler = (event: KeyboardEvent): void => {
    if (this.closable && event.key === "Escape" && !event.defaultPrevented) {
      this.handleUserClose();
      event.preventDefault();
    }
  };

  private handleUserClose = (): void => {
    this.closed = true;
    this.calcitePanelClose.emit();
  };

  open = (): void => {
    this.isClosed = false;
  };

  close = async (): Promise<void> => {
    const beforeClose = this.beforeClose ?? (() => Promise.resolve());

    try {
      await beforeClose();
    } catch (_error) {
      // close prevented
      requestAnimationFrame(() => {
        this.closed = false;
      });
      return;
    }

    this.isClosed = true;
  };

  collapse = (): void => {
    this.collapsed = !this.collapsed;
    this.calcitePanelToggle.emit();
  };

  panelScrollHandler = (): void => {
    this.calcitePanelScroll.emit();
  };

  handleHeaderActionsStartSlotChange = (event: Event): void => {
    this.hasStartActions = slotChangeHasAssignedElement(event);
  };

  handleHeaderActionsEndSlotChange = (event: Event): void => {
    this.hasEndActions = slotChangeHasAssignedElement(event);
  };

  handleHeaderMenuActionsSlotChange = (event: Event): void => {
    this.hasMenuItems = slotChangeHasAssignedElement(event);
  };

  handleActionBarSlotChange = (event: Event): void => {
    const actionBars = slotChangeGetAssignedElements(event).filter((el) =>
      el?.matches("calcite-action-bar"),
    ) as HTMLCalciteActionBarElement[];

    actionBars.forEach((actionBar) => (actionBar.layout = "horizontal"));

    this.hasActionBar = !!actionBars.length;
  };

  handleHeaderContentSlotChange = (event: Event): void => {
    this.hasHeaderContent = slotChangeHasAssignedElement(event);
  };

  handleFabSlotChange = (event: Event): void => {
    this.hasFab = slotChangeHasAssignedElement(event);
  };

  handleFooterActionsSlotChange = (event: Event): void => {
    this.hasFooterActions = slotChangeHasAssignedElement(event);
  };

  handleFooterEndSlotChange = (event: Event): void => {
    this.hasFooterEndContent = slotChangeHasAssignedElement(event);
  };

  handleFooterStartSlotChange = (event: Event): void => {
    this.hasFooterStartContent = slotChangeHasAssignedElement(event);
  };

  handleFooterSlotChange = (event: Event): void => {
    this.hasFooterContent = slotChangeHasAssignedElement(event);
  };

  private contentBottomSlotChangeHandler = (event: Event): void => {
    this.hasContentBottom = slotChangeHasAssignedElement(event);
  };

  private contentTopSlotChangeHandler = (event: Event): void => {
    this.hasContentTop = slotChangeHasAssignedElement(event);
  };

  // --------------------------------------------------------------------------
  //
  //  Methods
  //
  // --------------------------------------------------------------------------

  /**
   * Sets focus on the component's first focusable element.
   */
  @Method()
  async setFocus(): Promise<void> {
    await componentFocusable(this);
    focusFirstTabbable(this.containerEl);
  }

  /**
   * Scrolls the component's content to a specified set of coordinates.
   *
   * @example
   * myCalciteFlowItem.scrollContentTo({
   *   left: 0, // Specifies the number of pixels along the X axis to scroll the window or element.
   *   top: 0, // Specifies the number of pixels along the Y axis to scroll the window or element
   *   behavior: "auto" // Specifies whether the scrolling should animate smoothly (smooth), or happen instantly in a single jump (auto, the default value).
   * });
   * @param options - allows specific coordinates to be defined.
   * @returns - promise that resolves once the content is scrolled to.
   */
  @Method()
  async scrollContentTo(options?: ScrollToOptions): Promise<void> {
    this.panelScrollEl?.scrollTo(options);
  }

  // --------------------------------------------------------------------------
  //
  //  Render Methods
  //
  // --------------------------------------------------------------------------

  renderHeaderContent(): VNode {
    const { heading, headingLevel, description, hasHeaderContent } = this;
    const headingNode = heading ? (
      <Heading class={CSS.heading} level={headingLevel}>
        {heading}
      </Heading>
    ) : null;

    const descriptionNode = description ? <span class={CSS.description}>{description}</span> : null;

    return !hasHeaderContent && (headingNode || descriptionNode) ? (
      <div class={CSS.headerContent} key="header-content">
        {headingNode}
        {descriptionNode}
      </div>
    ) : null;
  }

  renderActionBar(): VNode {
    return (
      <div class={CSS.actionBarContainer} hidden={!this.hasActionBar}>
        <slot name={SLOTS.actionBar} onSlotchange={this.handleActionBarSlotChange} />
      </div>
    );
  }

  renderHeaderSlottedContent(): VNode {
    return (
      <div class={CSS.headerContent} hidden={!this.hasHeaderContent} key="slotted-header-content">
        <slot name={SLOTS.headerContent} onSlotchange={this.handleHeaderContentSlotChange} />
      </div>
    );
  }

  renderHeaderStartActions(): VNode {
    const { hasStartActions } = this;

    return (
      <div
        class={{ [CSS.headerActionsStart]: true, [CSS.headerActions]: true }}
        hidden={!hasStartActions}
        key="header-actions-start"
      >
        <slot
          name={SLOTS.headerActionsStart}
          onSlotchange={this.handleHeaderActionsStartSlotChange}
        />
      </div>
    );
  }

  renderHeaderActionsEnd(): VNode {
    const {
      hasEndActions,
      messages,
      closable,
      collapsed,
      collapseDirection,
      collapsible,
      hasMenuItems,
    } = this;
    const { collapse, expand, close } = messages;

    const icons = [ICONS.expand, ICONS.collapse];

    if (collapseDirection === "up") {
      icons.reverse();
    }

    const collapseNode = collapsible ? (
      <calcite-action
        aria-expanded={toAriaBoolean(!collapsed)}
        aria-label={collapse}
        icon={collapsed ? icons[0] : icons[1]}
        id={IDS.collapse}
        onClick={this.collapse}
        scale={this.scale}
        text={collapse}
        title={collapsed ? expand : collapse}
      />
    ) : null;

    const closeNode = closable ? (
      <calcite-action
        aria-label={close}
        icon={ICONS.close}
        id={IDS.close}
        onClick={this.handleUserClose}
        scale={this.scale}
        text={close}
        title={close}
      />
    ) : null;

    const slotNode = (
      <slot name={SLOTS.headerActionsEnd} onSlotchange={this.handleHeaderActionsEndSlotChange} />
    );

    const showContainer = hasEndActions || collapseNode || closeNode || hasMenuItems;

    return (
      <div
        class={{ [CSS.headerActionsEnd]: true, [CSS.headerActions]: true }}
        hidden={!showContainer}
        key="header-actions-end"
      >
        {slotNode}
        {this.renderMenu()}
        {collapseNode}
        {closeNode}
      </div>
    );
  }

  renderMenu(): VNode {
    const { hasMenuItems, messages, menuOpen } = this;

    return (
      <calcite-action-menu
        flipPlacements={["top", "bottom"]}
        hidden={!hasMenuItems}
        key="menu"
        label={messages.options}
        open={menuOpen}
        overlayPositioning={this.overlayPositioning}
        placement="bottom-end"
      >
        <calcite-action
          icon={ICONS.menu}
          scale={this.scale}
          slot={ACTION_MENU_SLOTS.trigger}
          text={messages.options}
        />
        <slot
          name={SLOTS.headerMenuActions}
          onSlotchange={this.handleHeaderMenuActionsSlotChange}
        />
      </calcite-action-menu>
    );
  }

  renderHeaderNode(): VNode {
    const {
      hasHeaderContent,
      hasStartActions,
      hasEndActions,
      closable,
      collapsible,
      hasMenuItems,
      hasActionBar,
    } = this;

    const headerContentNode = this.renderHeaderContent();

    const showHeaderContent =
      hasHeaderContent ||
      !!headerContentNode ||
      hasStartActions ||
      hasEndActions ||
      collapsible ||
      closable ||
      hasMenuItems;

    this.showHeaderContent = showHeaderContent;

    return (
      <header class={CSS.header} hidden={!(showHeaderContent || hasActionBar)}>
        <div
          class={{ [CSS.headerContainer]: true, [CSS.headerContainerBorderEnd]: hasActionBar }}
          hidden={!showHeaderContent}
        >
          {this.renderHeaderStartActions()}
          {this.renderHeaderSlottedContent()}
          {headerContentNode}
          {this.renderHeaderActionsEnd()}
        </div>
        {this.renderActionBar()}
        {this.renderContentTop()}
      </header>
    );
  }

  renderFooterNode(): VNode {
    const { hasFooterEndContent, hasFooterStartContent, hasFooterContent, hasFooterActions } = this;

    const showFooter =
      hasFooterStartContent || hasFooterEndContent || hasFooterContent || hasFooterActions;

    return (
      <footer class={CSS.footer} hidden={!showFooter}>
        <div class={CSS.footerContent} hidden={!hasFooterContent}>
          <slot name={SLOTS.footer} onSlotchange={this.handleFooterSlotChange} />
        </div>
        <div class={CSS.footerStart} hidden={hasFooterContent || !hasFooterStartContent}>
          <slot name={SLOTS.footerStart} onSlotchange={this.handleFooterStartSlotChange} />
        </div>
        <div class={CSS.footerEnd} hidden={hasFooterContent || !hasFooterEndContent}>
          <slot name={SLOTS.footerEnd} onSlotchange={this.handleFooterEndSlotChange} />
        </div>
        <div class={CSS.footerActions} hidden={hasFooterContent || !hasFooterActions}>
          <slot
            key="footer-actions-slot"
            name={SLOTS.footerActions}
            onSlotchange={this.handleFooterActionsSlotChange}
          />
        </div>
      </footer>
    );
  }

  setPanelScrollEl = (el: HTMLElement): void => {
    this.panelScrollEl = el;
    this.resizeObserver?.disconnect();

    if (el) {
      this.resizeObserver?.observe(el);
      this.resizeHandler();
    }
  };

  renderContent(): VNode {
    return (
      <div
        class={CSS.contentWrapper}
        hidden={this.collapsible && this.collapsed}
        onScroll={this.panelScrollHandler}
        ref={this.setPanelScrollEl}
      >
        <slot />
        {this.renderFab()}
      </div>
    );
  }

  renderContentBottom(): VNode {
    return (
      <div class={CSS.contentBottom} hidden={!this.hasContentBottom}>
        <slot name={SLOTS.contentBottom} onSlotchange={this.contentBottomSlotChangeHandler} />
      </div>
    );
  }

  renderContentTop(): VNode {
    return (
      <div class={CSS.contentTop} hidden={!this.hasContentTop}>
        <slot name={SLOTS.contentTop} onSlotchange={this.contentTopSlotChangeHandler} />
      </div>
    );
  }

  renderFab(): VNode {
    return (
      <div class={CSS.fabContainer} hidden={!this.hasFab}>
        <slot name={SLOTS.fab} onSlotchange={this.handleFabSlotChange} />
      </div>
    );
  }

  handleAlertsSlotChange = (event: Event): void => {
    slotChangeGetAssignedElements(event)?.map((el) => {
      if (el.nodeName === "CALCITE-ALERT") {
        (el as HTMLCalciteAlertElement).embedded = true;
      }
    });
  };

  render(): VNode {
    const { disabled, loading, panelKeyDownHandler, isClosed } = this;

    const panelNode = (
      <article
        aria-busy={toAriaBoolean(loading)}
        class={CSS.container}
        hidden={isClosed}
        ref={this.setContainerRef}
      >
        {this.renderHeaderNode()}
        {this.renderContent()}
        {this.renderContentBottom()}
        {this.renderFooterNode()}
        <slot key="alerts" name={SLOTS.alerts} onSlotchange={this.handleAlertsSlotChange} />
      </article>
    );

    return (
      <Host onKeyDown={panelKeyDownHandler}>
        <InteractiveContainer disabled={disabled}>
          {loading ? <calcite-scrim loading={loading} /> : null}
          {panelNode}
        </InteractiveContainer>
      </Host>
    );
  }
}
