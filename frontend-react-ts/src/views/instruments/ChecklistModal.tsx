import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axiosInstance from '../../services/api';

interface ChecklistItem {
  id: number;
  label: string;
  type: 'boolean' | 'text' | 'number';
  required: boolean;
  critical_ok: boolean;
  help_text?: string;
  placeholder?: string;
  min_value?: number;
  max_value?: number;
}

interface ChecklistResponse {
  id: number;
  value: boolean | string | number;
  ok: boolean;
  note: string;
}

interface Props {
  instrumentId: string;
  instrumentName: string;
  onChecklistComplete: (responses: ChecklistResponse[]) => void;
  onCancel: () => void;
}

export default function ChecklistModal({ instrumentId, instrumentName, onChecklistComplete, onCancel }: Props) {
  const [responses, setResponses] = useState<Map<number, ChecklistResponse>>(new Map());
  const [showValidation, setShowValidation] = useState(false);

  // Fetch checklist
  const { data: checklistData, isLoading } = useQuery({
    queryKey: ['checklist', instrumentId, 'initial'],
    queryFn: async () => {
      const res = await axiosInstance.get(`/api/instruments/${instrumentId}/checklist?type=initial`);
      return res.data.data;
    },
  });

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: async (checklistResponses: ChecklistResponse[]) => {
      const res = await axiosInstance.post('/api/instruments/validate-checklist', {
        instrument_id: parseInt(instrumentId),
        checklist_type: 'initial',
        responses: checklistResponses,
      });
      return res.data.data;
    },
  });

  const checklist = checklistData?.checklist_items || [];
  const requireAllOK = checklistData?.require_all_ok || true;

  // Initialize responses
  useEffect(() => {
    if (checklist.length > 0) {
      const initialResponses = new Map<number, ChecklistResponse>();
      checklist.forEach((item: ChecklistItem) => {
        initialResponses.set(item.id, {
          id: item.id,
          value: item.type === 'boolean' ? false : '',
          ok: false,
          note: '',
        });
      });
      setResponses(initialResponses);
    }
  }, [checklist]);

  const handleValueChange = (itemId: number, value: any, item: ChecklistItem) => {
    const currentResponse = responses.get(itemId)!;
    
    // Auto-determine OK status for boolean
    let ok = currentResponse.ok;
    if (item.type === 'boolean') {
      ok = value === true;
    } else if (item.type === 'number') {
      const numVal = parseFloat(value);
      ok = !isNaN(numVal) && 
           (item.min_value === undefined || numVal >= item.min_value) &&
           (item.max_value === undefined || numVal <= item.max_value);
    }

    setResponses(new Map(responses.set(itemId, {
      ...currentResponse,
      value,
      ok,
    })));
  };

  const handleOKChange = (itemId: number, ok: boolean) => {
    const currentResponse = responses.get(itemId)!;
    setResponses(new Map(responses.set(itemId, {
      ...currentResponse,
      ok,
    })));
  };

  const handleNoteChange = (itemId: number, note: string) => {
    const currentResponse = responses.get(itemId)!;
    setResponses(new Map(responses.set(itemId, {
      ...currentResponse,
      note,
    })));
  };

  const handleSubmit = async () => {
    setShowValidation(true);
    
    const responsesArray = Array.from(responses.values());
    
    try {
      const validationResult = await validateMutation.mutateAsync(responsesArray);
      
      if (validationResult.can_proceed) {
        onChecklistComplete(responsesArray);
      } else {
        alert(validationResult.message);
      }
    } catch (err: any) {
      alert('Validation failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const isFormValid = () => {
    for (const [_, response] of responses) {
      const item = checklist.find((i: ChecklistItem) => i.id === response.id);
      if (item?.required && !response.value) {
        return false;
      }
    }
    return true;
  };

  const allOK = Array.from(responses.values()).every(r => r.ok);
  const canProceed = !requireAllOK || allOK;

  if (isLoading) {
    return (
      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-body text-center py-5">
              <div className="spinner-border text-primary" />
              <p className="mt-3">Loading checklist...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="bi bi-clipboard-check me-2"></i>
              Initial Condition Checklist
            </h5>
          </div>

          <div className="modal-body">
            <div className="alert alert-info mb-4">
              <i className="bi bi-info-circle me-2"></i>
              <strong>{instrumentName}</strong>
              <br />
              <small>
                Please check all items before starting the reading process.
                {requireAllOK && " All items must be OK to proceed."}
              </small>
            </div>

            {checklist.map((item: ChecklistItem, idx: number) => {
              const response = responses.get(item.id);
              if (!response) return null;

              return (
                <div key={item.id} className="card mb-3 border">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <label className="form-label fw-bold mb-0">
                        {idx + 1}. {item.label}
                        {item.required && <span className="text-danger ms-1">*</span>}
                        {item.critical_ok && <span className="badge bg-warning ms-2">Critical</span>}
                      </label>
                    </div>

                    {item.help_text && (
                      <small className="text-muted d-block mb-2">
                        <i className="bi bi-lightbulb me-1"></i>
                        {item.help_text}
                      </small>
                    )}

                    <div className="row align-items-center">
                      <div className="col-md-7">
                        {/* Input based on type */}
                        {item.type === 'boolean' && (
                          <div className="form-check form-switch">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={response.value === true}
                              onChange={(e) => handleValueChange(item.id, e.target.checked, item)}
                            />
                            <label className="form-check-label">
                              {response.value === true ? 'Yes / OK' : 'No / NOT OK'}
                            </label>
                          </div>
                        )}

                        {item.type === 'text' && (
                          <input
                            type="text"
                            className="form-control"
                            placeholder={item.placeholder || 'Enter value'}
                            value={response.value as string}
                            onChange={(e) => handleValueChange(item.id, e.target.value, item)}
                          />
                        )}

                        {item.type === 'number' && (
                          <div>
                            <input
                              type="number"
                              className="form-control"
                              placeholder={item.placeholder || 'Enter number'}
                              value={response.value as number}
                              min={item.min_value}
                              max={item.max_value}
                              onChange={(e) => handleValueChange(item.id, e.target.value, item)}
                            />
                            {(item.min_value !== undefined || item.max_value !== undefined) && (
                              <small className="text-muted">
                                Range: {item.min_value ?? '-∞'} to {item.max_value ?? '∞'}
                              </small>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="col-md-5">
                        {/* OK / NOT OK Radio */}
                        <div className="btn-group w-100" role="group">
                          <input
                            type="radio"
                            className="btn-check"
                            id={`ok-${item.id}`}
                            checked={response.ok === true}
                            onChange={() => handleOKChange(item.id, true)}
                          />
                          <label className="btn btn-outline-success" htmlFor={`ok-${item.id}`}>
                            <i className="bi bi-check-circle me-1"></i>OK
                          </label>

                          <input
                            type="radio"
                            className="btn-check"
                            id={`notok-${item.id}`}
                            checked={response.ok === false}
                            onChange={() => handleOKChange(item.id, false)}
                          />
                          <label className="btn btn-outline-danger" htmlFor={`notok-${item.id}`}>
                            <i className="bi bi-x-circle me-1"></i>NOT OK
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Note field */}
                    {!response.ok && (
                      <div className="mt-2">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Note (optional - explain why NOT OK)"
                          value={response.note}
                          onChange={(e) => handleNoteChange(item.id, e.target.value)}
                        />
                      </div>
                    )}

                    {/* Validation feedback */}
                    {showValidation && item.required && !response.value && (
                      <small className="text-danger d-block mt-1">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        This field is required
                      </small>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Summary */}
            <div className={`alert ${allOK ? 'alert-success' : 'alert-warning'} mt-3`}>
              <strong>Summary:</strong>
              <br />
              {allOK ? (
                <span className="text-success">
                  <i className="bi bi-check-circle me-1"></i>
                  All items are OK. Ready to start reading.
                </span>
              ) : (
                <span>
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  {Array.from(responses.values()).filter(r => !r.ok).length} item(s) marked as NOT OK.
                  {requireAllOK && " All items must be OK to proceed."}
                </span>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!isFormValid() || validateMutation.isPending || (!canProceed)}
            >
              {validateMutation.isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Validating...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  Confirm & Start Reading
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}