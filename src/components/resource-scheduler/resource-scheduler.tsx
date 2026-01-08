import { useState, useCallback, useEffect, useRef } from "react";
import { DayPilot, DayPilotScheduler } from "@daypilot/daypilot-lite-react";
import { EventModal } from "./event-modal";
import type { EventStatus, EventFormData, SchedulerEvent } from "./types";
import "./resource-scheduler.css";
import "./daypilot-cez-theme.css";

/**
 * register czech locale for daypilot
 */
const czechLocale = new DayPilot.Locale("cs-cz", {
  dayNames: [
    "neděle",
    "pondělí",
    "úterý",
    "středa",
    "čtvrtek",
    "pátek",
    "sobota",
  ],
  dayNamesShort: ["ne", "po", "út", "st", "čt", "pá", "so"],
  monthNames: [
    "leden",
    "únor",
    "březen",
    "duben",
    "květen",
    "červen",
    "červenec",
    "srpen",
    "září",
    "říjen",
    "listopad",
    "prosinec",
  ],
  monthNamesShort: [
    "led",
    "úno",
    "bře",
    "dub",
    "kvě",
    "čvn",
    "čvc",
    "srp",
    "zář",
    "říj",
    "lis",
    "pro",
  ],
  timeFormat: "Clock24Hours",
  timePattern: "H:mm",
  datePattern: "d.M.yyyy",
  dateTimePattern: "d.M.yyyy H:mm",
  weekStarts: 1, // monday
});
DayPilot.Locale.register(czechLocale);

/**
 * cez color palette constants
 */
const CEZ_COLORS = {
  primary: "#F24F00",
  green: "#00C752",
  greenDark: "#008C47",
  red: "#F24F00",
  gray: "#989EA3",
  inkBase: "#63666A",
  inkLighter: "#DADFE3",
  inkLightest: "#EEF1F3",
  white: "#FFFFFF",
} as const;

/**
 * map event status to background color using cez palette
 * orange = on, gray = off
 */
function getStatusColor(status: EventStatus): string {
  switch (status) {
    case "on":
      return CEZ_COLORS.primary; // orange
    case "off":
      return CEZ_COLORS.gray;
    default:
      return CEZ_COLORS.inkBase;
  }
}

/**
 * flat resources - budova rows are group headers, assets are timeline rows
 * DayPilot Lite doesn't support tree/hierarchical resources
 */
interface ResourceItem {
  name: string;
  id: string;
  isGroup?: boolean;
}

const resources: ResourceItem[] = [
  { name: "Budova 1", id: "b1", isGroup: true },
  { name: "Asset 1.1", id: "a1.1" },
  { name: "Asset 1.2", id: "a1.2" },
  { name: "Budova 2", id: "b2", isGroup: true },
  { name: "Asset 2.1", id: "a2.1" },
  { name: "Asset 2.2", id: "a2.2" },
];

/**
 * get today's date as YYYY-MM-DD string
 */
function getTodayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * initial sample events for testing
 */
const todayStr = getTodayString();
const initialEvents: SchedulerEvent[] = [
  {
    id: 1,
    resourceId: "a1.1",
    start: `${todayStr} 08:15`,
    end: `${todayStr} 13:30`,
    title: "",
    status: "on",
  },
  {
    id: 2,
    resourceId: "a2.1",
    start: `${todayStr} 10:00`,
    end: `${todayStr} 12:00`,
    title: "",
    status: "off",
  },
];

let nextEventId = 100;

/**
 * format date to string "YYYY-MM-DD HH:mm"
 */
function formatDateTime(date: DayPilot.Date | string): string {
  const d = typeof date === "string" ? new DayPilot.Date(date) : date;
  return d.toString("yyyy-MM-dd HH:mm");
}

/**
 * convert our events to daypilot format
 * no text shown - color indicates status
 */
function toDayPilotEvents(events: SchedulerEvent[]): DayPilot.EventData[] {
  return events.map((e) => ({
    id: e.id,
    text: "",
    start: e.start.replace(" ", "T") + ":00",
    end: e.end.replace(" ", "T") + ":00",
    resource: e.resourceId,
    backColor: getStatusColor(e.status),
    status: e.status,
  }));
}

/**
 * check if two time ranges overlap
 */
function hasOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  const s1 = new Date(start1.replace(" ", "T")).getTime();
  const e1 = new Date(end1.replace(" ", "T")).getTime();
  const s2 = new Date(start2.replace(" ", "T")).getTime();
  const e2 = new Date(end2.replace(" ", "T")).getTime();
  return s1 < e2 && e1 > s2;
}

/**
 * main resource scheduler component
 */
/**
 * state for tracking drag selection time labels and multi-row selection
 */
interface DragTimeState {
  startTime: string;
  endTime: string;
  startX: number;
  endX: number;
  top: number;
  // multi-row support
  startY: number;
  endY: number;
  height: number;
  coveredResourceIds: string[];
  // resize mode indicator
  isResizing?: boolean;
  resizeEventId?: number;
  resizeResourceId?: string;
}

export function ResourceScheduler() {
  const [scheduler, setScheduler] = useState<DayPilot.Scheduler | null>(null);
  const [events, setEvents] = useState<SchedulerEvent[]>(initialEvents);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<EventFormData | null>(null);
  const [dragTime, setDragTime] = useState<DragTimeState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragTimeRef = useRef<DragTimeState | null>(null);
  const eventsRef = useRef<SchedulerEvent[]>(events);

  // keep refs in sync with state for access in callbacks
  useEffect(() => {
    dragTimeRef.current = dragTime;
  }, [dragTime]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  /**
   * ref for resize completion handler - allows useEffect to call latest version
   */
  const resizeCompleteRef = useRef<
    ((eventId: number, newStart: string, newEnd: string) => void) | null
  >(null);

  // update resize handler ref when events change
  useEffect(() => {
    resizeCompleteRef.current = (
      eventId: number,
      newStart: string,
      newEnd: string,
    ) => {
      const event = events.find((e) => e.id === eventId);
      if (!event) return;

      // check for conflicts
      const hasConflict = events.some(
        (e) =>
          e.id !== eventId &&
          e.resourceId === event.resourceId &&
          hasOverlap(newStart, newEnd, e.start, e.end),
      );

      if (hasConflict) {
        alert("Nelze změnit velikost - překrývá se s existující událostí");
        return;
      }

      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, start: newStart, end: newEnd } : e,
        ),
      );
    };
  }, [events]);

  /**
   * track drag selection and resize operations, update time labels
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const CELL_WIDTH = 15; // matches cellWidth prop
    const CELL_DURATION = 15; // minutes per cell

    /**
     * calculate time from x position relative to grid start
     * @param isEndTime - if true, adds CELL_DURATION to get the end of the cell (matching DayPilot behavior)
     */
    const calculateTimeFromX = (
      x: number,
      gridLeft: number,
      isEndTime = false,
    ): string => {
      const relativeX = x - gridLeft;
      const cellIndex = Math.floor(relativeX / CELL_WIDTH);
      // end time includes the full cell, so add CELL_DURATION
      const totalMinutes =
        cellIndex * CELL_DURATION + (isEndTime ? CELL_DURATION : 0);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}:${minutes.toString().padStart(2, "0")}`;
    };

    // selection state
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let gridLeft = 0;
    let rowTop = 0;

    // resize tracking state
    let isResizing = false;
    let resizeEdge: "left" | "right" | null = null;
    let resizeEventLeft = 0;
    let resizeEventRight = 0;
    let resizeRowTop = 0;
    const RESIZE_EDGE_WIDTH = 10;

    /**
     * snap x position to cell boundary
     */
    const snapToCell = (x: number, gridLeftPos: number): number => {
      const relativeX = x - gridLeftPos;
      const cellIndex = Math.floor(relativeX / CELL_WIDTH);
      return gridLeftPos + cellIndex * CELL_WIDTH;
    };

    /**
     * get resource ids for rows within Y range (excluding group rows)
     * uses rowheader elements which are in same order as resources array
     */
    const getRowsInYRange = (minY: number, maxY: number): string[] => {
      const rowHeaders = container.querySelectorAll(
        ".scheduler_cez_theme_rowheader_inner",
      );
      const coveredIds: string[] = [];

      rowHeaders.forEach((header, index) => {
        const headerRect = header.getBoundingClientRect();
        // check if row overlaps with selection range
        if (headerRect.bottom > minY && headerRect.top < maxY) {
          // map index to resource - rowheaders match resources array order
          const resource = resources[index];
          if (resource && !resource.isGroup) {
            coveredIds.push(resource.id);
          }
        }
      });

      return coveredIds;
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      const grid = container.querySelector(".scheduler_cez_theme_matrix");
      if (!grid) return;
      const gridRect = grid.getBoundingClientRect();
      gridLeft = gridRect.left;

      // check if clicking on an event (for resize tracking)
      const eventElement = target.closest(
        ".scheduler_cez_theme_event_inner",
      ) as HTMLElement | null;
      if (eventElement) {
        const eventRect = eventElement.getBoundingClientRect();
        const clickX = e.clientX;

        // find event by matching position - calculate time from X position
        const eventStartTime = calculateTimeFromX(
          eventRect.left,
          gridLeft,
          false,
        );
        const eventEndTime = calculateTimeFromX(
          eventRect.right - CELL_WIDTH,
          gridLeft,
          true,
        );

        // find matching event by time (format: "H:mm")
        const matchingEvent = eventsRef.current.find((ev) => {
          const evStartTime = ev.start.split(" ")[1]; // "YYYY-MM-DD HH:mm" -> "HH:mm"
          const evEndTime = ev.end.split(" ")[1];
          // normalize format (remove leading zeros for comparison)
          const normalize = (t: string) => {
            const [h, m] = t.split(":");
            return `${parseInt(h)}:${m}`;
          };
          return (
            normalize(evStartTime) === eventStartTime &&
            normalize(evEndTime) === eventEndTime
          );
        });

        const eventId = matchingEvent?.id ?? null;
        const resourceId = matchingEvent?.resourceId || null;

        // detect if near left or right edge
        const distFromLeft = clickX - eventRect.left;
        const distFromRight = eventRect.right - clickX;

        if (distFromLeft <= RESIZE_EDGE_WIDTH && eventId !== null) {
          // track resize from left edge - stop propagation to prevent time range selection
          e.stopPropagation();
          isResizing = true;
          resizeEdge = "left";
          resizeEventLeft = eventRect.left;
          resizeEventRight = eventRect.right;
          resizeRowTop = eventRect.top - containerRect.top;

          const startTime = calculateTimeFromX(eventRect.left, gridLeft, false);
          const endTime = calculateTimeFromX(
            eventRect.right - CELL_WIDTH,
            gridLeft,
            true,
          );

          setDragTime({
            startTime,
            endTime,
            startX: eventRect.left - containerRect.left,
            endX: eventRect.right - containerRect.left,
            top: resizeRowTop,
            startY: resizeRowTop,
            endY: resizeRowTop + eventRect.height,
            height: eventRect.height,
            coveredResourceIds: [],
            isResizing: true,
            resizeEventId: eventId,
            resizeResourceId: resourceId || undefined,
          });
        } else if (distFromRight <= RESIZE_EDGE_WIDTH && eventId !== null) {
          // track resize from right edge - stop propagation to prevent time range selection
          e.stopPropagation();
          isResizing = true;
          resizeEdge = "right";
          resizeEventLeft = eventRect.left;
          resizeEventRight = eventRect.right;
          resizeRowTop = eventRect.top - containerRect.top;

          const startTime = calculateTimeFromX(eventRect.left, gridLeft, false);
          const endTime = calculateTimeFromX(
            eventRect.right - CELL_WIDTH,
            gridLeft,
            true,
          );

          setDragTime({
            startTime,
            endTime,
            startX: eventRect.left - containerRect.left,
            endX: eventRect.right - containerRect.left,
            top: resizeRowTop,
            startY: resizeRowTop,
            endY: resizeRowTop + eventRect.height,
            height: eventRect.height,
            coveredResourceIds: [],
            isResizing: true,
            resizeEventId: eventId,
            resizeResourceId: resourceId || undefined,
          });
        }
        // don't return - let DayPilot handle the actual resize
        return;
      }

      // check if clicking on a grid cell (for selection/creation)
      const cell = target.closest(".scheduler_cez_theme_cell");
      if (!cell) return;

      isDragging = true;
      // snap start position to cell boundary
      startX = snapToCell(e.clientX, gridRect.left);
      startY = e.clientY;
      rowTop =
        (e.target as HTMLElement).getBoundingClientRect().top -
        containerRect.top;

      // get initial resource ID using Y position
      const initialCoveredIds = getRowsInYRange(e.clientY - 1, e.clientY + 1);

      const startTime = calculateTimeFromX(startX, gridLeft, false);
      setDragTime({
        startTime,
        endTime: calculateTimeFromX(startX, gridLeft, true),
        startX: startX - containerRect.left,
        endX: startX + CELL_WIDTH - containerRect.left,
        top: rowTop,
        startY: rowTop,
        endY: rowTop + 35,
        height: 35,
        coveredResourceIds: initialCoveredIds,
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      const containerRect = container.getBoundingClientRect();

      // handle resize tracking
      if (isResizing && resizeEdge) {
        const snappedX = snapToCell(e.clientX, gridLeft);

        let newLeft = resizeEventLeft;
        let newRight = resizeEventRight;

        if (resizeEdge === "left") {
          newLeft = snappedX;
          if (newLeft >= resizeEventRight - CELL_WIDTH) {
            newLeft = resizeEventRight - CELL_WIDTH;
          }
        } else {
          newRight = snappedX + CELL_WIDTH;
          if (newRight <= resizeEventLeft + CELL_WIDTH) {
            newRight = resizeEventLeft + CELL_WIDTH;
          }
        }

        const startTime = calculateTimeFromX(newLeft, gridLeft, false);
        const endTime = calculateTimeFromX(
          newRight - CELL_WIDTH,
          gridLeft,
          true,
        );

        // preserve event ID from initial mousedown
        const currentDragTime = dragTimeRef.current;
        setDragTime({
          startTime,
          endTime,
          startX: newLeft - containerRect.left,
          endX: newRight - containerRect.left,
          top: resizeRowTop,
          startY: resizeRowTop,
          endY: resizeRowTop + 36,
          height: 36,
          coveredResourceIds: [],
          isResizing: true,
          resizeEventId: currentDragTime?.resizeEventId,
          resizeResourceId: currentDragTime?.resizeResourceId,
        });
        return;
      }

      // handle selection drag
      if (!isDragging) return;

      const currentY = e.clientY;

      // snap current position to cell boundary (end of cell)
      const snappedCurrentX = snapToCell(e.clientX, gridLeft) + CELL_WIDTH;

      // determine which is actually start/end based on drag direction (X)
      const actualStartX = Math.min(startX, snapToCell(e.clientX, gridLeft));
      const actualEndX = Math.max(startX + CELL_WIDTH, snappedCurrentX);
      const actualStartTime = calculateTimeFromX(actualStartX, gridLeft, false);
      const actualEndTime = calculateTimeFromX(
        actualEndX - CELL_WIDTH,
        gridLeft,
        true,
      );

      // handle Y direction for multi-row selection
      const minY = Math.min(startY, currentY);
      const maxY = Math.max(startY, currentY);
      const coveredResourceIds = getRowsInYRange(minY, maxY);

      // calculate overlay position based on covered row headers
      const rowHeaders = container.querySelectorAll(
        ".scheduler_cez_theme_rowheader_inner",
      );
      let overlayTop = rowTop;
      let overlayBottom = rowTop + 35;

      rowHeaders.forEach((header, index) => {
        const resource = resources[index];
        if (resource && coveredResourceIds.includes(resource.id)) {
          const headerRect = header.getBoundingClientRect();
          const rowRelativeTop = headerRect.top - containerRect.top;
          const rowRelativeBottom = headerRect.bottom - containerRect.top;
          overlayTop = Math.min(overlayTop, rowRelativeTop);
          overlayBottom = Math.max(overlayBottom, rowRelativeBottom);
        }
      });

      setDragTime({
        startTime: actualStartTime,
        endTime: actualEndTime,
        startX: actualStartX - containerRect.left,
        endX: actualEndX - containerRect.left,
        top: overlayTop,
        startY: overlayTop,
        endY: overlayBottom,
        height: overlayBottom - overlayTop,
        coveredResourceIds,
      });
    };

    const handleMouseUp = () => {
      // check if we were resizing and need to update the event
      if (isResizing && dragTimeRef.current?.isResizing) {
        const dt = dragTimeRef.current;
        if (dt.resizeEventId !== undefined && resizeCompleteRef.current) {
          // convert time strings to full datetime format with leading zeros
          const todayStr = getTodayString();
          // ensure time has leading zeros (8:15 -> 08:15)
          const padTime = (t: string) => {
            const [h, m] = t.split(":");
            return `${h.padStart(2, "0")}:${m}`;
          };
          const newStart = `${todayStr} ${padTime(dt.startTime)}`;
          const newEnd = `${todayStr} ${padTime(dt.endTime)}`;
          resizeCompleteRef.current(dt.resizeEventId, newStart, newEnd);
        }
      }

      isDragging = false;
      isResizing = false;
      resizeEdge = null;
      // small delay to let the operation complete before hiding labels
      setTimeout(() => setDragTime(null), 100);
    };

    // use capturing phase for mousedown to intercept before DayPilot stops propagation
    container.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  /**
   * handle drag-to-create: user selects a time range (single or multi-row)
   */
  const handleTimeRangeSelected = useCallback(
    (args: DayPilot.SchedulerTimeRangeSelectedArgs) => {
      const start = formatDateTime(args.start);
      const end = formatDateTime(args.end);
      const singleResourceId = args.resource as string;

      // clear the visual selection
      scheduler?.clearSelection();

      // check for multi-row selection from drag state
      const multiRowIds = dragTimeRef.current?.coveredResourceIds;
      const resourceIds =
        multiRowIds && multiRowIds.length > 0
          ? multiRowIds
          : [singleResourceId];

      // filter out group rows
      const validIds = resourceIds.filter((id) => {
        const rowData = resources.find((r) => r.id === id);
        return rowData && !rowData.isGroup;
      });

      if (validIds.length === 0) {
        return;
      }

      // for single selection, check conflicts upfront
      if (validIds.length === 1) {
        const hasConflict = events.some(
          (e) =>
            e.resourceId === validIds[0] &&
            hasOverlap(start, end, e.start, e.end),
        );

        if (hasConflict) {
          alert("Cannot create event - overlaps with existing event");
          return;
        }
      }

      // open modal (conflicts for multi-row handled during confirm)
      setFormData({
        resourceId: validIds[0],
        resourceIds: validIds.length > 1 ? validIds : undefined,
        start,
        end,
        status: "on",
      });
      setModalOpen(true);
    },
    [events, scheduler],
  );

  /**
   * handle click on existing event to edit
   */
  const handleEventClick = useCallback(
    (args: DayPilot.SchedulerEventClickArgs) => {
      const eventId = Number(args.e.id());
      const existingEvent = events.find((e) => e.id === eventId);

      if (existingEvent) {
        setFormData({
          resourceId: existingEvent.resourceId,
          start: existingEvent.start,
          end: existingEvent.end,
          status: existingEvent.status,
          existingEventId: existingEvent.id,
        });
        setModalOpen(true);
      }
    },
    [events],
  );

  /**
   * handle event move (drag existing event)
   */
  const handleEventMoved = useCallback(
    (args: DayPilot.SchedulerEventMovedArgs) => {
      const eventId = Number(args.e.id());
      const newStart = formatDateTime(args.newStart);
      const newEnd = formatDateTime(args.newEnd);
      const newResource = args.newResource as string;

      // check for conflicts (excluding the moved event itself)
      const hasConflict = events.some(
        (e) =>
          e.id !== eventId &&
          e.resourceId === newResource &&
          hasOverlap(newStart, newEnd, e.start, e.end),
      );

      if (hasConflict) {
        alert("Cannot move event - overlaps with existing event");
        scheduler?.update();
        return;
      }

      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, start: newStart, end: newEnd, resourceId: newResource }
            : e,
        ),
      );
    },
    [events, scheduler],
  );

  /**
   * handle event resize (drag edge of existing event)
   */
  const handleEventResized = useCallback(
    (args: DayPilot.SchedulerEventResizedArgs) => {
      const eventId = Number(args.e.id());
      const newStart = formatDateTime(args.newStart);
      const newEnd = formatDateTime(args.newEnd);
      const resourceId = args.e.resource() as string;

      // check for conflicts (excluding the resized event itself)
      const hasConflict = events.some(
        (e) =>
          e.id !== eventId &&
          e.resourceId === resourceId &&
          hasOverlap(newStart, newEnd, e.start, e.end),
      );

      if (hasConflict) {
        alert("Nelze změnit velikost - překrývá se s existující událostí");
        scheduler?.update();
        return;
      }

      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, start: newStart, end: newEnd } : e,
        ),
      );
    },
    [events, scheduler],
  );

  /**
   * confirm event creation/update from modal
   */
  const handleModalConfirm = useCallback(
    (status: EventStatus) => {
      if (!formData) return;

      if (formData.existingEventId !== undefined) {
        // update existing event (single only)
        setEvents((prev) =>
          prev.map((e) =>
            e.id === formData.existingEventId ? { ...e, status } : e,
          ),
        );
      } else {
        // create new event(s) - handle single or multi-row
        const resourceIds = formData.resourceIds || [formData.resourceId];
        const created: string[] = [];
        const conflicts: string[] = [];

        for (const resourceId of resourceIds) {
          const hasConflict = events.some(
            (e) =>
              e.resourceId === resourceId &&
              hasOverlap(formData.start, formData.end, e.start, e.end),
          );

          if (hasConflict) {
            conflicts.push(resourceId);
          } else {
            const newEvent: SchedulerEvent = {
              id: nextEventId++,
              resourceId,
              start: formData.start,
              end: formData.end,
              title: "",
              status,
            };
            setEvents((prev) => [...prev, newEvent]);
            created.push(resourceId);
          }
        }

        // show summary for multi-row with partial conflicts
        if (conflicts.length > 0 && created.length > 0) {
          alert(
            `Vytvořeno ${created.length} záznamů. ${conflicts.length} přeskočeno kvůli konfliktům.`,
          );
        } else if (conflicts.length > 0 && created.length === 0) {
          alert("Nelze vytvořit - všechna zařízení mají konflikty.");
          return; // don't close modal if all failed
        }
      }

      setModalOpen(false);
      setFormData(null);
    },
    [formData, events],
  );

  /**
   * delete event from modal
   */
  const handleModalDelete = useCallback(() => {
    if (!formData?.existingEventId) return;

    setEvents((prev) => prev.filter((e) => e.id !== formData.existingEventId));
    setModalOpen(false);
    setFormData(null);
  }, [formData]);

  /**
   * cancel modal
   */
  const handleModalCancel = useCallback(() => {
    setModalOpen(false);
    setFormData(null);
  }, []);

  // calculate today's date for the scheduler (full day)
  const startDate = DayPilot.Date.today();

  /**
   * customize row headers - green background for groups, orange + button for assets
   */
  const handleBeforeRowHeaderRender = useCallback(
    (args: DayPilot.SchedulerBeforeRowHeaderRenderArgs) => {
      const rowData = resources.find((r) => r.id === args.row.id);
      const isGroup = rowData?.isGroup;

      if (isGroup) {
        // group row (budova) - green background
        args.row.backColor = CEZ_COLORS.green;
        args.row.fontColor = CEZ_COLORS.white;
      } else {
        // asset row - add orange + button
        args.row.areas = [
          {
            right: 8,
            top: "calc(50% - 14px)",
            width: 28,
            height: 28,
            html: `<div class="cez-add-btn">+</div>`,
            action: "None",
            onClick: (clickArgs: { source: { id: string | number } }) => {
              // create event at current time for this resource
              const now = new DayPilot.Date();
              const roundedStart = now.addMinutes(-now.getMinutes() % 15);
              const roundedEnd = roundedStart.addMinutes(60);

              const start = formatDateTime(roundedStart);
              const end = formatDateTime(roundedEnd);
              const resourceId = clickArgs.source.id as string;

              // check for conflicts
              const hasConflict = events.some(
                (e) =>
                  e.resourceId === resourceId &&
                  hasOverlap(start, end, e.start, e.end),
              );

              if (hasConflict) {
                alert("Cannot create event - overlaps with existing event");
                return;
              }

              setFormData({
                resourceId,
                start,
                end,
                status: "on",
              });
              setModalOpen(true);
            },
          },
        ];
      }
    },
    [events],
  );

  /**
   * customize event rendering - add floating time labels
   */
  const handleBeforeEventRender = useCallback(
    (args: DayPilot.SchedulerBeforeEventRenderArgs) => {
      const startTime = new DayPilot.Date(args.data.start).toString("H:mm");
      const endTime = new DayPilot.Date(args.data.end).toString("H:mm");

      // add floating time labels above the event
      args.data.areas = [
        {
          left: 0,
          top: -18,
          width: 40,
          height: 16,
          html: `<span class="cez-time-label">${startTime}</span>`,
        },
        {
          right: 0,
          top: -18,
          width: 40,
          height: 16,
          html: `<span class="cez-time-label">${endTime}</span>`,
        },
      ];
    },
    [],
  );

  /**
   * customize cell rendering - hide cells for group (budova) rows
   */
  const handleBeforeCellRender = useCallback(
    (args: DayPilot.SchedulerBeforeCellRenderArgs) => {
      const resource = args.cell.resource;
      // check if this is a group row (budova)
      const rowData = resources.find((r) => r.id === resource);
      if (rowData?.isGroup) {
        // hide cells for group rows - make them blend with header
        args.cell.properties.backColor = CEZ_COLORS.inkLightest;
        args.cell.properties.cssClass = "parent-row-cell";
      }
    },
    [],
  );

  /**
   * handle add schedule button click
   */
  const handleAddScheduleClick = useCallback(() => {
    // open modal with default values for first asset
    const now = new DayPilot.Date();
    const roundedStart = now.addMinutes(-now.getMinutes() % 15);
    const roundedEnd = roundedStart.addMinutes(60);

    setFormData({
      resourceId: "a1.1",
      start: formatDateTime(roundedStart),
      end: formatDateTime(roundedEnd),
      status: "on",
    });
    setModalOpen(true);
  }, []);

  return (
    <div className="resource-scheduler" ref={containerRef}>
      {/* custom selection overlay and time labels during drag */}
      {dragTime && (
        <>
          {/* selection rectangle */}
          <div
            className="drag-selection-overlay"
            style={{
              left: dragTime.startX,
              top: dragTime.top,
              width: Math.max(dragTime.endX - dragTime.startX, 2),
              height: Math.max(dragTime.height, 35),
            }}
          />
          {/* floating time labels */}
          <div
            className="drag-time-label drag-time-start"
            style={{ left: dragTime.startX, top: dragTime.top - 24 }}
          >
            {dragTime.startTime}
          </div>
          <div
            className="drag-time-label drag-time-end"
            style={{ left: dragTime.endX, top: dragTime.top - 24 }}
          >
            {dragTime.endTime}
          </div>
        </>
      )}
      <div className="scheduler-header">
        <h2>Kalendář provozu</h2>
        <button className="btn-add-schedule" onClick={handleAddScheduleClick}>
          Přidat rozvrh
        </button>
      </div>

      <DayPilotScheduler
        startDate={startDate}
        days={1}
        scale="CellDuration"
        cellDuration={15}
        cellWidth={15}
        rowHeaderWidth={180}
        eventHeight={36}
        businessBeginsHour={0}
        businessEndsHour={24}
        locale="cs-cz"
        timeFormat="Clock24Hours"
        timeHeaders={[{ groupBy: "Day", format: "dddd d.M.yyyy" }]}
        resources={resources}
        events={toDayPilotEvents(events)}
        timeRangeSelectedHandling="Enabled"
        onTimeRangeSelected={handleTimeRangeSelected}
        eventClickHandling="Enabled"
        onEventClick={handleEventClick}
        eventMoveHandling="Update"
        onEventMoved={handleEventMoved}
        eventResizeHandling="Update"
        onEventResized={handleEventResized}
        onBeforeRowHeaderRender={handleBeforeRowHeaderRender}
        onBeforeEventRender={handleBeforeEventRender}
        onBeforeCellRender={handleBeforeCellRender}
        theme="scheduler_cez_theme"
        controlRef={setScheduler}
      />

      <EventModal
        isOpen={modalOpen}
        formData={formData}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
        onDelete={handleModalDelete}
        resourceNames={new Map(resources.map((r) => [r.id, r.name]))}
      />
    </div>
  );
}
