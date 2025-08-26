

import {
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  CardActions,
  Button
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useState, useEffect } from 'react';
import type { Embellishment } from '../types';
import { createEmbellishment, fetchEmbellishments, updateEmbellishment, deleteEmbellishment } from '../store/slices/embellishmentsSlice';
import type { RootState, AppDispatch } from '../store';
import AddEmbellishmentModal from '../components/embellishments/AddEmbellishmentModal';
import EditEmbellishmentModal from '../components/embellishments/EditEmbellishmentModal';

export default function EmbellishmentsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading, error } = useSelector((state: RootState) => state.embellishments);
  const { currentProfile } = useSelector((state: RootState) => state.auth);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmbellishment, setSelectedEmbellishment] = useState<Embellishment | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch embellishments when the page loads
  useEffect(() => {
    if (currentProfile) {
      dispatch(fetchEmbellishments(currentProfile.id));
    }
  }, [dispatch, currentProfile]);

  const handleEditEmbellishment = (embellishment: Embellishment) => {
    // Prevent editing built-in embellishments
    if (embellishment.isBuiltIn) {
      console.warn('Cannot edit built-in embellishments');
      return;
    }
    
    setSelectedEmbellishment(embellishment);
    setIsEditModalOpen(true);
  };

  const handleAddEmbellishment = () => {
    setIsAddModalOpen(true);
  };

  const handleSubmitEmbellishment = async (embellishmentData: Omit<Embellishment, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>) => {
    if (!currentProfile) {
      console.error('No current profile selected');
      return;
    }

    try {
      const embellishmentToCreate = {
        ...embellishmentData,
        isBuiltIn: false
      };
      
      await dispatch(createEmbellishment({ 
        embellishmentData: embellishmentToCreate, 
        profileId: currentProfile.id 
      })).unwrap();
      
      // Close modal on success
      setIsAddModalOpen(false);
      
      // Show success feedback (you could add a toast notification here)
      console.log('Embellishment created successfully!');
    } catch (error) {
      console.error('Failed to create embellishment:', error);
      // Error will be displayed in the modal via the error prop
    }
  };

  const handleUpdateEmbellishment = async (updates: Partial<Embellishment>) => {
    if (!currentProfile || !selectedEmbellishment) {
      console.error('No current profile or selected embellishment');
      return;
    }

    setIsUpdating(true);
    try {
      await dispatch(updateEmbellishment({
        id: selectedEmbellishment.id,
        updates,
        profileId: currentProfile.id
      })).unwrap();
      
      // Close modal on success
      setIsEditModalOpen(false);
      setSelectedEmbellishment(null);
      
      // Show success feedback
      console.log('Embellishment updated successfully!');
    } catch (error) {
      console.error('Failed to update embellishment:', error);
      // Error will be displayed in the modal via the error prop
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteEmbellishment = async (embellishmentId: string) => {
    if (!currentProfile) {
      console.error('No current profile selected');
      return;
    }

    try {
      await dispatch(deleteEmbellishment(embellishmentId)).unwrap();
      
      // Close modal on success
      setIsEditModalOpen(false);
      setSelectedEmbellishment(null);
      
      // Show success feedback
      console.log('Embellishment deleted successfully!');
    } catch (error) {
      console.error('Failed to delete embellishment:', error);
      // Error will be displayed in the modal via the error prop
    }
  };

  // Helper function to determine if an embellishment is built-in
  const isBuiltIn = (embellishment: Embellishment) => {
    return embellishment.isBuiltIn;
  };

  return (
    <Box sx={{ 
      height: '100%', // Use full height of parent container
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative',
      overflow: 'hidden' // Prevent outer page scrolling
    }}>
      {/* Scrollable Content Area */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto', // Enable scrolling for content
        p: 3,
        minHeight: 0 // Ensure flex child can shrink properly
      }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
              Embellishments
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage prompt embellishments - quick shortcuts to enhance your AI conversations
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddEmbellishment}
            disabled={loading}
            sx={{ borderRadius: 2 }}
          >
            {loading ? 'Adding...' : 'Add Embellishment'}
          </Button>
        </Box>

      {/* Embellishments Grid */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {items.map((embellishment) => (
          <Box 
            key={embellishment.id}
            sx={{ 
              width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(33.333% - 16px)' },
              minWidth: 300
            }}
          >
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                border: 1,
                borderColor: 'divider',
                position: 'relative',
                '&:hover': {
                  boxShadow: 3,
                  borderColor: embellishment.color
                }
              }}
            >
              {/* Built-in indicator */}
              {isBuiltIn(embellishment) && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    zIndex: 1
                  }}
                >
                  Built-in
                </Box>
              )}

              <CardContent sx={{ flexGrow: 1, pt: isBuiltIn(embellishment) ? 4 : 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Chip 
                    label={embellishment.name}
                    sx={{ 
                      backgroundColor: embellishment.color,
                      color: 'white',
                      fontWeight: 600,
                      mr: 1
                    }}
                  />
                  <Chip 
                    label={embellishment.category}
                    variant="outlined"
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {embellishment.instructions}
                </Typography>
              </CardContent>
              
              <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">
                  {!isBuiltIn(embellishment) && `Updated ${new Date(embellishment.updatedAt).toLocaleDateString()}`}
                </Typography>
                {!isBuiltIn(embellishment) && (
                  <Box>
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={() => handleEditEmbellishment(embellishment)}
                      disabled={isUpdating && selectedEmbellishment?.id === embellishment.id}
                      sx={{ color: 'primary.dark', borderColor: 'primary.dark' }}
                    >
                      {isUpdating && selectedEmbellishment?.id === embellishment.id ? 'Saving...' : 'Edit'}
                    </Button>
                  </Box>
                )}
              </CardActions>
            </Card>
          </Box>
        ))}
      </Box>
      </Box>

      {/* Add Embellishment Modal */}
      <AddEmbellishmentModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleSubmitEmbellishment}
        loading={loading}
        error={error}
      />

      {/* Edit Embellishment Modal */}
      <EditEmbellishmentModal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEmbellishment(null);
        }}
        onSubmit={handleUpdateEmbellishment}
        onDelete={handleDeleteEmbellishment}
        embellishment={selectedEmbellishment}
        loading={isUpdating}
        error={error}
      />
    </Box>
  );
}
