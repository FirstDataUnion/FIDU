import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
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

const optionStyle = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  '&.Mui-selected': {
    borderColor: 'primary.main',
  },
};

type DocumentType = 'fidu' | 'google_drive';
function DocumentTypeStep({
  onNext,
}: {
  onNext: (documentType: DocumentType) => void;
}) {
  const [selectedDocumentType, setSelectedDocumentType] = useState<
    DocumentType | undefined
  >(undefined);

  const handleNext = useCallback(() => {
    setSelectedDocumentType(undefined);
    if (!selectedDocumentType) {
      console.error('Next pressed with no document type selected');
      return;
    }
    onNext(selectedDocumentType);
  }, [setSelectedDocumentType, onNext, selectedDocumentType]);

  return (
    <>
      <Box>
        <Typography>Choose type of document to add</Typography>
        <List disablePadding sx={{ mt: 2 }}>
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              selected={selectedDocumentType === 'fidu'}
              onClick={() => setSelectedDocumentType('fidu')}
              sx={optionStyle}
            >
              <ListItemText
                primary={<Typography variant="h6">FIDU Document</Typography>}
                secondary={
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Stored in your FIDU Vault, alongside your conversations.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      This is encrypted before storage so Google cannot read it.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      A Markdown document managed entirely within ChatLab.
                    </Typography>
                  </>
                }
              />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              selected={selectedDocumentType === 'google_drive'}
              onClick={() => setSelectedDocumentType('google_drive')}
              sx={optionStyle}
            >
              <ListItemText
                primary={
                  <Typography variant="h6">Google Drive Document</Typography>
                }
                secondary={
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Stored as a normal file in your Google Drive.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      This is not encrypted so Google (or anyone with access to
                      your Google Drive) can read it and it is subject to
                      Google's Terms of Service.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Larger variety of file types supported, including PDFs and
                      Google Docs.
                    </Typography>
                  </>
                }
              />
            </ListItemButton>
          </ListItem>
        </List>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="primary"
            disabled={!selectedDocumentType}
            onClick={handleNext}
          >
            Next
          </Button>
        </Box>
      </Box>
    </>
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
  const [selectedCurrentLocation, setSelectedCurrentLocation] = useState<
    CurrentLocation | undefined
  >(undefined);

  const handleNext = useCallback(() => {
    if (!selectedCurrentLocation) {
      console.error('Next pressed with no current location selected');
      return;
    }
    onNext(selectedCurrentLocation);
  }, [selectedCurrentLocation, onNext]);

  return (
    <>
      <Box>
        <Typography>Where is the document located?</Typography>
        <List disablePadding sx={{ mt: 2 }}>
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              selected={selectedCurrentLocation === 'google_drive'}
              onClick={() => setSelectedCurrentLocation('google_drive')}
              sx={optionStyle}
            >
              <ListItemText
                primary={<Typography variant="h6">Google Drive</Typography>}
                secondary={
                  <>
                    <Typography variant="body2" color="text.secondary">
                      The file already exists in your Google Drive.
                    </Typography>
                  </>
                }
              />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              selected={selectedCurrentLocation === 'local'}
              onClick={() => setSelectedCurrentLocation('local')}
              sx={optionStyle}
              disabled={true}
            >
              <ListItemText
                primary={<Typography variant="h6">Local File</Typography>}
                secondary={
                  <>
                    <Typography variant="body2" color="text.secondary">
                      The file is on your local machine.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      This file will be uploaded to Google Drive and stored
                      there.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      This feature is not yet implemented. Please upload the
                      file manually and proceed with the other option.
                    </Typography>
                  </>
                }
              />
            </ListItemButton>
          </ListItem>
        </List>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="primary"
            disabled={!selectedCurrentLocation}
            onClick={handleNext}
          >
            Next
          </Button>
        </Box>
      </Box>
    </>
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
