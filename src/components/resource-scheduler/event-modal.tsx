import { useState, useEffect } from "react";
import type { EventStatus, EventFormData } from "./types";

interface EventModalProps {
  isOpen: boolean;
  formData: EventFormData | null;
  onConfirm: (status: EventStatus) => void;
  onCancel: () => void;
  onDelete?: () => void;
  resourceNames?: Map<string, string>; // id -> display name
}

/**
 * modal dialog for creating or editing an event (single or multi-row)
 */
export function EventModal({
  isOpen,
  formData,
  onConfirm,
  onCancel,
  onDelete,
  resourceNames,
}: EventModalProps) {
  const [status, setStatus] = useState<EventStatus>("on");

  useEffect(() => {
    if (formData) {
      setStatus(formData.status);
    }
  }, [formData]);

  if (!isOpen || !formData) return null;

  const isEditing = formData.existingEventId !== undefined;
  const isMultiRow = formData.resourceIds && formData.resourceIds.length > 1;
  const selectedCount = formData.resourceIds?.length || 1;

  /**
   * get display name for a resource id
   */
  const getResourceName = (id: string): string => {
    return resourceNames?.get(id) || id;
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{isEditing ? "Upravit událost" : "Vytvořit událost"}</h3>

        <div className="modal-info">
          <p>
            <strong>Čas:</strong> {formData.start.split(" ")[1]} -{" "}
            {formData.end.split(" ")[1]}
          </p>
        </div>

        {isMultiRow && formData.resourceIds && (
          <div className="multi-resource-list">
            <p className="multi-resource-label">
              Vybraná zařízení ({selectedCount}):
            </p>
            <ul>
              {formData.resourceIds.map((id) => (
                <li key={id}>{getResourceName(id)}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="modal-field">
          <label>Stav:</label>
          <div className="status-buttons">
            <button
              type="button"
              className={`status-btn status-on ${status === "on" ? "active" : ""}`}
              onClick={() => setStatus("on")}
            >
              Zapnuto
            </button>
            <button
              type="button"
              className={`status-btn status-off ${status === "off" ? "active" : ""}`}
              onClick={() => setStatus("off")}
            >
              Vypnuto
            </button>
          </div>
        </div>

        <div className="modal-actions">
          {isEditing && onDelete && (
            <button type="button" className="btn-delete" onClick={onDelete}>
              Smazat
            </button>
          )}
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Zrušit
          </button>
          <button
            type="button"
            className="btn-confirm"
            onClick={() => onConfirm(status)}
          >
            {isMultiRow
              ? `Vytvořit ${selectedCount} záznamů`
              : isEditing
                ? "Uložit"
                : "Vytvořit"}
          </button>
        </div>
      </div>
    </div>
  );
}
