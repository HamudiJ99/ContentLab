import { Box, Typography, Paper } from '@mui/material';

export default function Members() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Mitglieder
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Mitgliederübersicht folgt.
        </Typography>
      </Paper>
    </Box>
  );
}
