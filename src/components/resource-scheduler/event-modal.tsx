import { useState, useEffect } from "react";
import type { EventStatus, EventFormData } from "./types";

interface EventModalProps {
  isOpen: boolean;
  formData: EventFormData | null;
  onConfirm: (status: EventStatus) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

/**
 * modal dialog for creating or editing an event
 */
export function EventModal({
  isOpen,
  formData,
  onConfirm,
  onCancel,
  onDelete,
}: EventModalProps) {
  const [status, setStatus] = useState<EventStatus>("on");

  useEffect(() => {
    if (formData) {
      setStatus(formData.status);
    }
  }, [formData]);

  if (!isOpen || !formData) return null;

  const isEditing = formData.existingEventId !== undefined;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{isEditing ? "Edit Event" : "Create Event"}</h3>

        <div className="modal-info">
          <p>
            <strong>Time:</strong> {formData.start.split(" ")[1]} -{" "}
            {formData.end.split(" ")[1]}
          </p>
        </div>

        <div className="modal-field">
          <label>Status:</label>
          <div className="status-buttons">
            <button
              type="button"
              className={`status-btn status-on ${status === "on" ? "active" : ""}`}
              onClick={() => setStatus("on")}
            >
              On
            </button>
            <button
              type="button"
              className={`status-btn status-off ${status === "off" ? "active" : ""}`}
              onClick={() => setStatus("off")}
            >
              Off
            </button>
            <button
              type="button"
              className={`status-btn status-empty ${status === "empty" ? "active" : ""}`}
              onClick={() => setStatus("empty")}
            >
              Empty
            </button>
          </div>
        </div>

        <div className="modal-actions">
          {isEditing && onDelete && (
            <button type="button" className="btn-delete" onClick={onDelete}>
              Delete
            </button>
          )}
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-confirm"
            onClick={() => onConfirm(status)}
          >
            {isEditing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
