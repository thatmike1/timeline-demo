import { useState, useCallback } from "react";
import { DayPilot, DayPilotScheduler } from "@daypilot/daypilot-lite-react";
import { EventModal } from "./event-modal";
import type { EventStatus, EventFormData, SchedulerEvent } from "./types";
import "./resource-scheduler.css";

/**
 * map event status to background color
 */
function getStatusColor(status: EventStatus): string {
  switch (status) {
    case "on":
      return "#4caf50";
    case "off":
      return "#f44336";
    case "empty":
      return "#9e9e9e";
    default:
      return "#2196f3";
  }
}

/**
 * hierarchical resources - buildings contain assets
 */
const resources = [
  {
    name: "Budova 1",
    id: "b1",
    expanded: true,
    children: [
      { name: "Asset 1.1", id: "a1.1" },
      { name: "Asset 1.2", id: "a1.2" },
    ],
  },
  {
    name: "Budova 2",
    id: "b2",
    expanded: true,
    children: [
      { name: "Asset 2.1", id: "a2.1" },
      { name: "Asset 2.2", id: "a2.2" },
    ],
  },
];

/**
 * initial sample events
 */
const initialEvents: SchedulerEvent[] = [
  {
    id: 1,
    resourceId: "a1.1",
    start: "2025-01-07 08:15",
    end: "2025-01-07 13:30",
    title: "On",
    status: "on",
  },
  {
    id: 2,
    resourceId: "a2.1",
    start: "2025-01-07 10:00",
    end: "2025-01-07 12:00",
    title: "Off",
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
 */
function toDayPilotEvents(events: SchedulerEvent[]): DayPilot.EventData[] {
  return events.map((e) => ({
    id: e.id,
    text: e.title,
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
export function ResourceScheduler() {
  const [scheduler, setScheduler] = useState<DayPilot.Scheduler | null>(null);
  const [events, setEvents] = useState<SchedulerEvent[]>(initialEvents);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<EventFormData | null>(null);

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
        args.e.data.start = args.e.data.start; // revert
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

      const title = status.charAt(0).toUpperCase() + status.slice(1);

      if (formData.existingEventId !== undefined) {
        // update existing event
        setEvents((prev) =>
          prev.map((e) =>
            e.id === formData.existingEventId ? { ...e, status, title } : e,
          ),
        );
      } else {
        // create new event
        const newEvent: SchedulerEvent = {
          id: nextEventId++,
          resourceId: formData.resourceId,
          start: formData.start,
          end: formData.end,
          title,
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

  // calculate today's date for the scheduler (6:00 to 22:00)
  const today = DayPilot.Date.today();
  const startDate = today.addHours(6);

  return (
    <div className="resource-scheduler">
      <div className="scheduler-header">
        <h2>Resource Timeline Scheduler</h2>
        <div className="legend">
          <span className="legend-item">
            <span className="legend-color status-on"></span> On
          </span>
          <span className="legend-item">
            <span className="legend-color status-off"></span> Off
          </span>
          <span className="legend-item">
            <span className="legend-color status-empty"></span> Empty
          </span>
        </div>
      </div>

      <DayPilotScheduler
        startDate={startDate}
        days={1}
        scale="CellDuration"
        cellDuration={15}
        businessBeginsHour={6}
        businessEndsHour={22}
        timeHeaders={[
          { groupBy: "Day", format: "dddd, MMMM d, yyyy" },
          { groupBy: "Hour" },
          { groupBy: "Cell", format: "mm" },
        ]}
        resources={resources}
        events={toDayPilotEvents(events)}
        timeRangeSelectedHandling="Enabled"
        onTimeRangeSelected={handleTimeRangeSelected}
        eventClickHandling="Enabled"
        onEventClick={handleEventClick}
        eventMoveHandling="Update"
        onEventMoved={handleEventMoved}
        eventResizeHandling="Disabled"
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
