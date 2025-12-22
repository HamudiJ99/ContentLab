import { Box, Typography, Paper } from '@mui/material';

export default function Profile() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Profil
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Profilinhalte folgen.
        </Typography>
      </Paper>
    </Box>
  );
}
