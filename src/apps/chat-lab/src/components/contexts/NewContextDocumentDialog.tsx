import { Button, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { useCallback, useState } from 'react';
import { useAppDispatch } from '../../store';
import { selectCurrentProfile } from '../../store/selectors/conversationsSelectors';
import { useAppSelector } from '../../hooks/redux';
import {
  createContext,
  createContextCorpusDocument,
} from '../../store/slices/contextsSlice';
import CreateContextDialog from './CreateContextDialog';
import type { ContextFormData } from '../../types/contexts';
import { DrivePicker } from '../../services/drive/DrivePicker';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';
import WizardChoiceScreen from './WizardChoiceScreen';

type DocumentType = 'fidu' | 'google_drive';
function DocumentTypeStep({
  onNext,
}: {
  onNext: (documentType: DocumentType) => void;
}) {
  return (
    <WizardChoiceScreen
      title="Choose type of document to add"
      choices={[
        {
          label: 'FIDU Document',
          value: 'fidu',
          description: [
            <>Stored in your FIDU Vault, alongside your conversations.</>,
            <>This is encrypted before storage so Google cannot read it.</>,
            <>A Markdown document managed entirely within ChatLab.</>,
          ],
        },
        {
          label: 'Google Drive Document',
          value: 'google_drive',
          description: [
            <>Stored as a normal file in your Google Drive.</>,
            <>
              This is not encrypted so Google (or anyone with access to your
              Google Drive) can read it and it is subject to Google's Terms of
              Service.
            </>,
            <>
              Larger variety of file types supported, including PDFs and Google
              Docs.
            </>,
          ],
        },
      ]}
      onChoiceMade={onNext}
    />
  );
}

function CreateFiduContextStep({
  onCreate,
  onClose,
}: {
  onCreate: (form: ContextFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ContextFormData>({
    title: '',
    body: '',
    tags: [],
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(() => {
    setIsCreating(true);
    onCreate(form);
  }, [form, onCreate]);

  const handleClose = useCallback(() => {
    setIsCreating(false);
    onClose();
  }, [onClose]);

  return (
    <CreateContextDialog
      form={form}
      onFormChange={setForm}
      onCreate={handleCreate}
      onClose={handleClose}
      isCreating={isCreating}
      open={true}
    />
  );
}

type CurrentLocation = 'google_drive' | 'local';
function GoogleDriveDocumentLocationStep({
  onNext,
}: {
  onNext: (currentLocation: CurrentLocation) => void;
}) {
  return (
    <WizardChoiceScreen
      title="Where is the document located?"
      choices={[
        {
          label: 'Google Drive',
          value: 'google_drive',
          description: [<>The file already exists in your Google Drive.</>],
        },
        {
          label: 'Local File',
          value: 'local',
          disabled: true,
          description: [
            <>The file is on your local machine.</>,
            <>This file will be uploaded to Google Drive and stored there.</>,
            <>
              This feature is not yet implemented. Please upload the file
              manually and proceed with the other option.
            </>,
          ],
        },
      ]}
      onChoiceMade={onNext}
    />
  );
}

function GoogleDriveDocumentPickerStep({
  onNext,
}: {
  onNext: (documents: any[]) => void;
}) {
  console.log('GoogleDriveDocumentPickerStep');
  const openPicker = useCallback(async () => {
    const authService = await getGoogleDriveAuthService();
    const drivePicker = new DrivePicker({ authService });
    console.log('openPicker');
    await drivePicker.pickFilesFromFolder({
      title: 'Select documents',
      includeFolders: false,
      enableMultiSelect: true,
      onFilesPicked: documents => {
        onNext(documents);
      },
    });
  }, [onNext]);
  return (
    <>
      <Button variant="outlined" color="primary" onClick={openPicker}>
        Select Documents
      </Button>
    </>
  );
}

export default function NewContextDocumentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  type Steps =
    | 'document_type'
    | 'create_fidu_context'
    | 'google_drive_document_location'
    | 'google_drive_pick_documents';
  const [step, setStep] = useState<Steps>('document_type');
  const dispatch = useAppDispatch();
  const currentProfile = useAppSelector(selectCurrentProfile);

  const resetState = useCallback(() => {
    setStep('document_type');
  }, [setStep]);

  const handleDocumentTypeNext = useCallback(
    (documentType: DocumentType) => {
      if (documentType === 'fidu') {
        setStep('create_fidu_context');
      } else {
        setStep('google_drive_document_location');
      }
    },
    [setStep]
  );

  const handleFiduDocumentCreate = useCallback(
    async (form: ContextFormData) => {
      if (!currentProfile?.id) {
        console.error('No profile ID found');
        return;
      }
      await dispatch(
        createContext({
          contextData: form,
          profileId: currentProfile.id,
        })
      );
      resetState();
      onClose();
    },
    [resetState, onClose, currentProfile?.id, dispatch]
  );

  const handleGoogleDriveDocumentCreate = useCallback(
    async (documents: any[]) => {
      console.log({ documents });
      if (!currentProfile?.id) {
        console.error('No profile ID found');
        return;
      }
      const promises = documents
        .map(document => ({
          name: document.name as string,
          location: {
            type: 'google_drive' as const,
            fileId: document.id as string,
            mimeType: document.mimeType as string,
          },
        }))
        .map(document => {
          console.log('Creating context corpus document', document);
          return dispatch(
            createContextCorpusDocument({
              data: document,
              profileId: currentProfile.id,
            })
          );
        });
      await Promise.all(promises);
      resetState();
      onClose();
    },
    [currentProfile?.id, resetState, onClose, dispatch]
  );

  const handleClose = useCallback(() => {
    onClose();
    resetState();
  }, [onClose, resetState]);

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Add New Context Document</DialogTitle>
      <DialogContent>
        {step === 'document_type' ? (
          <DocumentTypeStep onNext={handleDocumentTypeNext} />
        ) : step === 'create_fidu_context' ? (
          <CreateFiduContextStep
            onCreate={handleFiduDocumentCreate}
            onClose={handleClose}
          />
        ) : step === 'google_drive_document_location' ? (
          <GoogleDriveDocumentLocationStep
            onNext={() => {
              setStep('google_drive_pick_documents');
            }}
          />
        ) : step === 'google_drive_pick_documents' ? (
          <GoogleDriveDocumentPickerStep
            onNext={handleGoogleDriveDocumentCreate}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
