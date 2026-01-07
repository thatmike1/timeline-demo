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
 * initial sample events
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
 * state for tracking drag selection time labels
 */
interface DragTimeState {
  startTime: string;
  endTime: string;
  startX: number;
  endX: number;
  top: number;
}

export function ResourceScheduler() {
  const [scheduler, setScheduler] = useState<DayPilot.Scheduler | null>(null);
  const [events, setEvents] = useState<SchedulerEvent[]>(initialEvents);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<EventFormData | null>(null);
  const [dragTime, setDragTime] = useState<DragTimeState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * track drag selection and update time labels
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

    let isDragging = false;
    let startX = 0;
    let gridLeft = 0;
    let rowTop = 0;

    /**
     * snap x position to cell boundary
     */
    const snapToCell = (x: number, gridLeftPos: number): number => {
      const relativeX = x - gridLeftPos;
      const cellIndex = Math.floor(relativeX / CELL_WIDTH);
      return gridLeftPos + cellIndex * CELL_WIDTH;
    };

    const handleMouseDown = (e: MouseEvent) => {
      // check if clicking on a grid cell (not header or row header)
      const target = e.target as HTMLElement;
      const cell = target.closest(".scheduler_cez_theme_cell");
      if (!cell) return;

      const grid = container.querySelector(".scheduler_cez_theme_matrix");
      if (!grid) return;

      const gridRect = grid.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      isDragging = true;
      // snap start position to cell boundary
      startX = snapToCell(e.clientX, gridRect.left);
      gridLeft = gridRect.left;
      rowTop =
        (e.target as HTMLElement).getBoundingClientRect().top -
        containerRect.top;

      const startTime = calculateTimeFromX(startX, gridLeft, false);
      setDragTime({
        startTime,
        endTime: calculateTimeFromX(startX, gridLeft, true),
        startX: startX - containerRect.left,
        endX: startX + CELL_WIDTH - containerRect.left,
        top: rowTop,
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const containerRect = container.getBoundingClientRect();

      // snap current position to cell boundary (end of cell)
      const snappedCurrentX = snapToCell(e.clientX, gridLeft) + CELL_WIDTH;

      // determine which is actually start/end based on drag direction
      const actualStartX = Math.min(startX, snapToCell(e.clientX, gridLeft));
      const actualEndX = Math.max(startX + CELL_WIDTH, snappedCurrentX);
      const actualStartTime = calculateTimeFromX(actualStartX, gridLeft, false);
      const actualEndTime = calculateTimeFromX(
        actualEndX - CELL_WIDTH,
        gridLeft,
        true,
      );

      setDragTime({
        startTime: actualStartTime,
        endTime: actualEndTime,
        startX: actualStartX - containerRect.left,
        endX: actualEndX - containerRect.left,
        top: rowTop,
      });
    };

    const handleMouseUp = () => {
      isDragging = false;
      // small delay to let the selection complete before hiding labels
      setTimeout(() => setDragTime(null), 100);
    };

    container.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  /**
   * handle drag-to-create: user selects a time range
   */
  const handleTimeRangeSelected = useCallback(
    (args: DayPilot.SchedulerTimeRangeSelectedArgs) => {
      const start = formatDateTime(args.start);
      const end = formatDateTime(args.end);
      const resourceId = args.resource as string;

      // clear the visual selection
      scheduler?.clearSelection();

      // check if this is a group row (budova) - don't allow selection
      const rowData = resources.find((r) => r.id === resourceId);
      if (rowData?.isGroup) {
        return;
      }

      // check for conflicts
      const hasConflict = events.some(
        (e) =>
          e.resourceId === resourceId && hasOverlap(start, end, e.start, e.end),
      );

      if (hasConflict) {
        alert("Cannot create event - overlaps with existing event");
        return;
      }

      // open modal to select status
      setFormData({
        resourceId,
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
   * confirm event creation/update from modal
   */
  const handleModalConfirm = useCallback(
    (status: EventStatus) => {
      if (!formData) return;

      if (formData.existingEventId !== undefined) {
        // update existing event
        setEvents((prev) =>
          prev.map((e) =>
            e.id === formData.existingEventId ? { ...e, status } : e,
          ),
        );
      } else {
        // create new event
        const newEvent: SchedulerEvent = {
          id: nextEventId++,
          resourceId: formData.resourceId,
          start: formData.start,
          end: formData.end,
          title: "",
          status,
        };
        setEvents((prev) => [...prev, newEvent]);
      }

      setModalOpen(false);
      setFormData(null);
    },
    [formData],
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
              height: 35,
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

      <div className="legend">
        <span className="legend-item">
          <span className="legend-color status-on"></span> Zapnuto
        </span>
        <span className="legend-item">
          <span className="legend-color status-off"></span> Vypnuto
        </span>
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
        eventResizeHandling="Disabled"
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
      />
    </div>
  );
}
