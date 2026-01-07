/**
 * status of a scheduled event block
 */
export type EventStatus = "on" | "off";

/**
 * resource in the scheduler (building or asset)
 */
export interface Resource {
  id: string;
  name: string;
  groupOnly?: boolean;
  parentId?: string;
}

/**
 * scheduled event on the timeline
 */
export interface SchedulerEvent {
  id: number;
  resourceId: string;
  start: string;
  end: string;
  title: string;
  status: EventStatus;
  bgColor?: string;
  [key: string]: unknown;
}

/**
 * data for creating/editing an event via modal
 */
export interface EventFormData {
  resourceId: string;
  start: string;
  end: string;
  status: EventStatus;
  existingEventId?: number;
}
