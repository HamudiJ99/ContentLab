import { Box, Typography, Paper } from '@mui/material';

export default function Home() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Home
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Home-Inhalte folgen.
        </Typography>
      </Paper>
    </Box>
  );
}
