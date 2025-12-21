import { Typography, Box } from '@mui/material';

export default function Dashboard() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Dashboard
      </Typography>
      <Typography>Willkommen im Dashboard!</Typography>
    </Box>
  );
}
