import { useState } from 'react';
import ChecklistManagementPage from './ChecklistManagementPage';
import ChecklistConfigPage from './ChecklistConfigPage';
import {
  useChecklistByName,
  useInstrumentsChecklistStatus,
  useChecklistByNameDetail,
  useInstrumentChecklistConfig,
  useCreateChecklistByName,
  useUpdateChecklistByName,
  useDeleteChecklistByName,
  useUpdateInstrumentChecklistConfig,
} from '../../../hooks/admin/useChecklistManagement';

type Mode = 
  | 'list' 
  | 'create-by-name'
  | 'edit-by-name'
  | 'configure-instrument';

export default function AdminChecklistWrapper() {
  const [mode, setMode] = useState<Mode>('list');
  const [selectedByNameId, setSelectedByNameId] = useState<number | undefined>();
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<number | undefined>();
  const [prefilledData, setPrefilledData] = useState<any>(null);

  // Queries - Only run when needed
  const { data: byNameData, isLoading: loadingByName } = useChecklistByName();
  const { data: instrumentsData, isLoading: loadingInstruments } = useInstrumentsChecklistStatus();
  
  // 🔧 FIX: Directly use number (no conversion needed)
  const { 
    data: byNameDetailData, 
    isLoading: loadingDetail,
    isError: errorDetail 
  } = useChecklistByNameDetail(
    mode === 'edit-by-name' && selectedByNameId ? selectedByNameId : undefined
  );
  
  // 🔧 FIX: Directly use number (no conversion needed)
  const { 
    data: instrumentConfigData,
    isLoading: loadingConfig,
    isError: errorConfig
  } = useInstrumentChecklistConfig(
    mode === 'configure-instrument' && selectedInstrumentId ? selectedInstrumentId : undefined
  );

  // Mutations
  const createByNameMutation = useCreateChecklistByName();
  const updateByNameMutation = useUpdateChecklistByName();
  const deleteByNameMutation = useDeleteChecklistByName();
  const updateInstrumentConfigMutation = useUpdateInstrumentChecklistConfig();

  const byNameConfigs = byNameData?.data || [];
  const instruments = instrumentsData?.data || [];

  // Handlers - By Name
  const handleCreateByName = (instrumentType: string, instrumentName: string) => {
    console.log('Creating checklist for:', { instrumentType, instrumentName });
    setMode('create-by-name');
    setSelectedByNameId(undefined);
    setPrefilledData({ 
      instrument_type: instrumentType,
      instrument_name: instrumentName 
    });
  };

  const handleEditByName = (configId: number) => {
    console.log('✏️ Editing checklist ID:', configId);
    setMode('edit-by-name');
    setSelectedByNameId(configId);
    setPrefilledData(null);
  };

  const handleDeleteByName = async (configId: number) => {
    try {
      await deleteByNameMutation.mutateAsync(configId);
      alert('Configuration deleted successfully!');
    } catch (err: any) {
      console.error('❌ Delete error:', err);
      alert('Failed to delete config: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSaveByName = async (data: {
    initialItems: any[];
    finalItems: any[];
    requireAllInitialOK: boolean;
    requireAllFinalOK: boolean;
  }) => {
    try {
      console.log('💾 Saving checklist:', { mode, data, prefilledData });

      // 🔧 Transform frontend format to backend format
      const transformItems = (items: any[]) => {
        return items.map(item => ({
          id: item.id,
          label: item.label,
          type: item.type,
          required: item.required,
          critical_ok: item.critical_ok,
          help_text: item.help_text || '',
          placeholder: item.placeholder || '',
          min_value: item.min_value,
          max_value: item.max_value,
        }));
      };

      if (mode === 'create-by-name') {
        if (!prefilledData?.instrument_name) {
          alert('Missing instrument name');
          return;
        }

        await createByNameMutation.mutateAsync({
          instrument_name: prefilledData.instrument_name,
          initial_checklist_items: transformItems(data.initialItems),
          final_checklist_items: transformItems(data.finalItems),
          require_all_initial_ok: data.requireAllInitialOK,
          require_all_final_ok: data.requireAllFinalOK,
          description: '',
        });

        alert('Checklist by name created successfully!');
        setMode('list');
        setPrefilledData(null);
      } else if (mode === 'edit-by-name' && selectedByNameId) {
        const config = byNameDetailData?.data;
        if (!config) {
          alert('Config data not loaded');
          return;
        }

        await updateByNameMutation.mutateAsync({
          configId: selectedByNameId,
          data: {
            instrument_name: config.instrument_name,
            initial_checklist_items: transformItems(data.initialItems),
            final_checklist_items: transformItems(data.finalItems),
            require_all_initial_ok: data.requireAllInitialOK,
            require_all_final_ok: data.requireAllFinalOK,
            description: config.description,
          },
        });

        alert('Checklist by name updated successfully!');
        setMode('list');
        setSelectedByNameId(undefined);
      }
    } catch (err: any) {
      console.error('❌ Save error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message;
      alert('Failed to save config: ' + errorMessage);
    }
  };

  // Handlers - Individual Instrument
  const handleConfigureInstrument = (instrumentId: number) => {
    console.log('⚙️ Configuring instrument ID:', instrumentId);
    setMode('configure-instrument');
    setSelectedInstrumentId(instrumentId);
    setPrefilledData(null);
  };

  const handleSaveInstrumentConfig = async (data: {
    initialItems: any[];
    finalItems: any[];
    requireAllInitialOK: boolean;
    requireAllFinalOK: boolean;
  }) => {
    if (!selectedInstrumentId) return;

    try {
      console.log('💾 Saving instrument config:', { instrumentId: selectedInstrumentId, data });

      // 🔧 Transform frontend format to backend format
      const transformItems = (items: any[]) => {
        return items.map(item => ({
          id: item.id,
          label: item.label,
          type: item.type,
          required: item.required,
          critical_ok: item.critical_ok,
          help_text: item.help_text || '',
          placeholder: item.placeholder || '',
          min_value: item.min_value,
          max_value: item.max_value,
        }));
      };

      await updateInstrumentConfigMutation.mutateAsync({
        instrumentId: selectedInstrumentId,
        data: {
          initial_checklist_items: transformItems(data.initialItems),
          final_checklist_items: transformItems(data.finalItems),
          require_all_initial_ok: data.requireAllInitialOK,
          require_all_final_ok: data.requireAllFinalOK,
        },
      });

      alert('Instrument checklist configured successfully!');
      setMode('list');
      setSelectedInstrumentId(undefined);
    } catch (err: any) {
      console.error('❌ Save instrument config error:', err);
      console.error('Error response:', err.response?.data);
      
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message;
      alert('Failed to save config: ' + errorMessage);
    }
  };

  const handleCancel = () => {
    console.log('❌ Cancelled, returning to list');
    setMode('list');
    setSelectedByNameId(undefined);
    setSelectedInstrumentId(undefined);
    setPrefilledData(null);
  };

  // ==================== RENDER LOGIC ====================

  // Mode: List
  if (mode === 'list') {
    return (
      <ChecklistManagementPage
        byNameConfigs={byNameConfigs}
        instruments={instruments}
        onCreateByName={handleCreateByName}
        onEditByName={handleEditByName}
        onDeleteByName={handleDeleteByName}
        onConfigureInstrument={handleConfigureInstrument}
        isLoading={loadingByName || loadingInstruments}
      />
    );
  }

  // Mode: Create By Name
  if (mode === 'create-by-name') {
    if (!prefilledData?.instrument_name) {
      return (
        <div className="container mt-5">
          <div className="alert alert-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Missing instrument name. Please go back and try again.
            <button className="btn btn-sm btn-secondary ms-3" onClick={handleCancel}>
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return (
      <ChecklistConfigPage
        key="create-by-name"
        instrumentName={prefilledData.instrument_name}
        existingInitialItems={[]}
        existingFinalItems={[]}
        existingRequireAllInitialOK={true}
        existingRequireAllFinalOK={false}
        onSave={handleSaveByName}
        onCancel={handleCancel}
        isSaving={createByNameMutation.isPending}
      />
    );
  }

  // Mode: Edit By Name
  if (mode === 'edit-by-name') {
    if (loadingDetail) {
      return (
        <div className="container mt-5">
          <div className="text-center">
            <div className="spinner-border text-primary" />
            <p className="mt-3">Loading checklist configuration...</p>
          </div>
        </div>
      );
    }

    if (errorDetail || !byNameDetailData?.data) {
      return (
        <div className="container mt-5">
          <div className="alert alert-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Failed to load checklist configuration. Please try again.
            <button className="btn btn-sm btn-secondary ms-3" onClick={handleCancel}>
              Go Back
            </button>
          </div>
        </div>
      );
    }

    const config = byNameDetailData.data;
    return (
      <ChecklistConfigPage
        key={`edit-by-name-${selectedByNameId}`}
        instrumentName={config.instrument_name}
        existingInitialItems={config.initial_checklist_items || []}
        existingFinalItems={config.final_checklist_items || []}
        existingRequireAllInitialOK={config.require_all_initial_ok}
        existingRequireAllFinalOK={config.require_all_final_ok}
        onSave={handleSaveByName}
        onCancel={handleCancel}
        isSaving={updateByNameMutation.isPending}
      />
    );
  }

  // Mode: Configure Instrument
  if (mode === 'configure-instrument') {
    if (loadingConfig) {
      return (
        <div className="container mt-5">
          <div className="text-center">
            <div className="spinner-border text-primary" />
            <p className="mt-3">Loading instrument configuration...</p>
          </div>
        </div>
      );
    }

    if (errorConfig || !instrumentConfigData?.data) {
      return (
        <div className="container mt-5">
          <div className="alert alert-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Failed to load instrument configuration. Please try again.
            <button className="btn btn-sm btn-secondary ms-3" onClick={handleCancel}>
              Go Back
            </button>
          </div>
        </div>
      );
    }

    const config = instrumentConfigData.data;
    return (
      <ChecklistConfigPage
        key={`configure-instrument-${selectedInstrumentId}`}
        instrumentId={selectedInstrumentId?.toString()}
        instrumentName={config.instrument_name}
        existingInitialItems={config.initial_checklist_items || []}
        existingFinalItems={config.final_checklist_items || []}
        existingRequireAllInitialOK={config.require_all_initial_ok}
        existingRequireAllFinalOK={config.require_all_final_ok}
        onSave={handleSaveInstrumentConfig}
        onCancel={handleCancel}
        isSaving={updateInstrumentConfigMutation.isPending}
      />
    );
  }

  // Fallback (should never reach here)
  return (
    <div className="container mt-5">
      <div className="alert alert-warning">
        <i className="bi bi-exclamation-triangle me-2"></i>
        Unknown mode: {mode}
        <button className="btn btn-sm btn-secondary ms-3" onClick={handleCancel}>
          Go Back
        </button>
      </div>
    </div>
  );
}