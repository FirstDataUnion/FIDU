import {
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Folder as FolderIcon,
  FolderOff as ClearFolderIcon,
} from '@mui/icons-material';
import { useMemo, useState } from 'react';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';
import { DrivePicker } from '../../services/drive/DrivePicker';

export type CreateCorpusFormState = {
  name: string;
  description: string;
  fileName: string;
  folderOption: 'root' | 'existing' | 'new';
  pickerFolder?: { id: string; name: string };
  newFolderName?: string;
};

type CreateCorpusFormErrors = Partial<
  Record<
    'name' | 'description' | 'fileName' | 'pickerFolder' | 'newFolderName',
    string
  >
> & { form?: string };

type CreateCorpusTouched = Partial<
  Record<
    'name' | 'description' | 'fileName' | 'pickerFolder' | 'newFolderName',
    boolean
  >
>;

function validateAndCleanCreateCorpusForm(form: CreateCorpusFormState): {
  clean?: CreateCorpusFormState;
  errors: CreateCorpusFormErrors;
} {
  const errors: CreateCorpusFormErrors = {};

  const name = form.name.trim();
  const fileName = form.fileName.trim();
  const description = form.description.trim();
  const newFolderName = form.newFolderName?.trim();

  if (!name) {
    errors.name = 'Name is required';
  } else if (name.length > 64) {
    errors.name = 'Name must be 64 characters or less';
  }

  if (!fileName) {
    errors.fileName = 'File name is required';
  } else if (fileName.length > 64) {
    errors.fileName = 'File name must be 64 characters or less';
  }

  if (description.length > 256) {
    errors.description = 'Description must be 256 characters or less';
  }

  if (form.folderOption === 'existing') {
    if (!form.pickerFolder?.id) {
      errors.pickerFolder = 'Please select a folder';
    }
  }

  if (form.folderOption === 'new') {
    if (!newFolderName) {
      errors.newFolderName = 'New folder name is required';
    } else if (newFolderName.length > 64) {
      errors.newFolderName = 'New folder name must be 64 characters or less';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const base: CreateCorpusFormState = {
    ...form,
    name,
    fileName,
    description,
    newFolderName: newFolderName || undefined,
  };

  if (form.folderOption === 'root') {
    return {
      errors,
      clean: {
        ...base,
        pickerFolder: undefined,
        newFolderName: undefined,
      },
    };
  }

  if (form.folderOption === 'existing') {
    return {
      errors,
      clean: {
        ...base,
        newFolderName: undefined,
      },
    };
  }

  // folderOption === 'new'
  return { errors, clean: base };
}

function formatEmphasis(text: string | undefined) {
  if (!text) {
    return undefined;
  }
  return (
    <Box component="span" sx={{ color: 'secondary.main' }}>
      {text}
    </Box>
  );
}

export function CreateCorpusPanel(props: {
  creating: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmitClean: (clean: CreateCorpusFormState) => void;
}) {
  const { creating, error, onCancel, onSubmitClean } = props;

  const [form, setForm] = useState<CreateCorpusFormState>({
    name: '',
    description: '',
    fileName: 'fidu-research-lab.db',
    folderOption: 'root',
    pickerFolder: undefined,
    newFolderName: undefined,
  });
  const [touched, setTouched] = useState<CreateCorpusTouched>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const validation = useMemo(() => {
    return validateAndCleanCreateCorpusForm(form);
  }, [form]);

  function fieldError<K extends keyof CreateCorpusFormErrors>(key: K) {
    const message = validation.errors[key];
    const shouldShow =
      submitAttempted || Boolean(touched[key as keyof CreateCorpusTouched]);
    return shouldShow ? message : undefined;
  }

  function touchField(key: keyof CreateCorpusTouched) {
    setTouched(prev => (prev[key] ? prev : { ...prev, [key]: true }));
  }

  function clearPickerFolder() {
    setForm(prev => ({ ...prev, pickerFolder: undefined }));
    touchField('pickerFolder');
  }

  async function pickDriveFolder() {
    touchField('pickerFolder');
    const authService = await getGoogleDriveAuthService();
    const drivePicker = new DrivePicker({ authService });

    const result = await drivePicker.pickFolder({
      title: 'Select a Google Drive folder',
    });

    if (!result.success || !result.folderId || !result.folderName) {
      return;
    }

    setForm(prev => ({
      ...prev,
      pickerFolder: {
        id: result.folderId!,
        name: result.folderName!,
      },
    }));
  }

  function folderPickerButton(label: string) {
    const hasSelection = Boolean(form.pickerFolder?.id);
    const handleClick = () => {
      if (hasSelection) {
        clearPickerFolder();
      } else {
        void pickDriveFolder();
      }
    };

    return (
      <FormControlLabel
        labelPlacement="top"
        label={label}
        control={
          <Button
            variant="contained"
            color="primary"
            startIcon={hasSelection ? <ClearFolderIcon /> : <FolderIcon />}
            onClick={handleClick}
          >
            {hasSelection ? 'Clear Folder' : 'Select Folder'}
          </Button>
        }
        sx={{ width: '95%', mt: 2 }}
      />
    );
  }

  function handleSubmit() {
    setSubmitAttempted(true);
    if (!validation.clean) {
      return;
    }
    onSubmitClean(validation.clean);
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5">Create a new Corpus</Typography>

      <FormControlLabel
        labelPlacement="top"
        label="Name (within Research Lab)"
        control={
          <TextField
            fullWidth
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            onBlur={() => touchField('name')}
            error={Boolean(fieldError('name'))}
            helperText={fieldError('name')}
          />
        }
        sx={{ width: '95%', mt: 2 }}
      />

      <FormControlLabel
        labelPlacement="top"
        label="Description"
        control={
          <TextField
            fullWidth
            multiline
            rows={2}
            value={form.description}
            onChange={e =>
              setForm(prev => ({ ...prev, description: e.target.value }))
            }
            onBlur={() => touchField('description')}
            error={Boolean(fieldError('description'))}
            helperText={fieldError('description')}
          />
        }
        sx={{ width: '95%', mt: 2 }}
      />

      <FormControlLabel
        labelPlacement="top"
        label="File name (on Google Drive)"
        control={
          <TextField
            fullWidth
            value={form.fileName}
            onChange={e =>
              setForm(prev => ({ ...prev, fileName: e.target.value }))
            }
            onBlur={() => touchField('fileName')}
            error={Boolean(fieldError('fileName'))}
            helperText={fieldError('fileName')}
          />
        }
        sx={{ width: '95%', mt: 2 }}
      />

      <RadioGroup
        value={form.folderOption ?? 'root'}
        onChange={e =>
          setForm(prev => ({
            ...prev,
            folderOption: e.target
              .value as CreateCorpusFormState['folderOption'],
          }))
        }
        name="google-drive-folder-option"
        sx={{ width: '95%', mt: 2 }}
      >
        <FormControlLabel
          value="root"
          control={<Radio />}
          label="Add file to Google Drive root"
        />
        <FormControlLabel
          value="existing"
          control={<Radio />}
          label="Add file to existing Google Drive folder"
        />
        <FormControlLabel
          value="new"
          control={<Radio />}
          label="Add file to new Google Drive folder"
        />
      </RadioGroup>

      {form.folderOption === 'existing'
        && folderPickerButton('Select a folder on Google Drive')}
      {form.folderOption === 'existing' && fieldError('pickerFolder') && (
        <Typography variant="body2" color="error" sx={{ width: '95%', mt: 1 }}>
          {fieldError('pickerFolder')}
        </Typography>
      )}

      {form.folderOption === 'new' && (
        <>
          <FormControlLabel
            labelPlacement="top"
            label="Name of new folder on Google Drive"
            control={
              <TextField
                fullWidth
                value={form.newFolderName}
                onChange={e =>
                  setForm(prev => ({ ...prev, newFolderName: e.target.value }))
                }
                onBlur={() => touchField('newFolderName')}
                error={Boolean(fieldError('newFolderName'))}
                helperText={fieldError('newFolderName')}
              />
            }
            sx={{ width: '95%', mt: 2 }}
          />
          {folderPickerButton(
            'Select parent folder on Google Drive (optional)'
          )}
        </>
      )}

      <Box sx={{ my: 3 }}>
        <hr style={{ border: 0, borderTop: '1px solid #ccc', margin: 0 }} />
      </Box>

      <Typography variant="h6">Summary</Typography>
      <Typography variant="body1">
        {validation.clean ? (
          <>
            {form.folderOption === 'root' && (
              <>
                FIDU will create a new corpus backed by a database in your
                Google Drive. <br />
                The database file will be named {formatEmphasis(
                  form.fileName
                )}{' '}
                and will be stored in the root of your Google Drive.
              </>
            )}
            {form.folderOption === 'existing' && (
              <>
                FIDU will create a new corpus backed by a database in your
                Google Drive. <br />
                The database file will be named {formatEmphasis(
                  form.fileName
                )}{' '}
                and will be stored in your{' '}
                {formatEmphasis(form.pickerFolder?.name)} folder on Google
                Drive.
              </>
            )}
            {form.folderOption === 'new' && (
              <>
                FIDU will create a new folder named{' '}
                {formatEmphasis(form.newFolderName)} in{' '}
                {form.pickerFolder?.name ? (
                  <>the {formatEmphasis(form.pickerFolder.name)} folder</>
                ) : (
                  'the root'
                )}{' '}
                of your Google Drive.
                <br />
                We will then create a new corpus backed by a database in that
                new folder.
                <br />
                The database file will be named {formatEmphasis(form.fileName)}.
              </>
            )}
          </>
        ) : (
          <>Complete the required fields to see a summary here.</>
        )}
      </Typography>

      <Stack
        direction="row"
        spacing={2}
        justifyContent="flex-end"
        sx={{ width: '95%', mt: 3 }}
      >
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={creating}>
          {creating ? 'Creating...' : 'Create Corpus'}
        </Button>
      </Stack>
      {error && (
        <Typography variant="body2" color="error" sx={{ width: '95%', mt: 1 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
