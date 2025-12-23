import { Box, Divider, Link, Stack, Typography } from '@mui/material';

const footerLinks = [
  { label: 'Impressum', href: '/impressum' },
  { label: 'Datenschutz', href: '/datenschutz' },
  { label: 'Kontakt', href: '/kontakt' },
];

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        width: '100%',
        backgroundColor: (theme) =>
          theme.palette.mode === 'light' ? '#f8fafc' : 'rgba(15, 23, 42, 0.55)',
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        mt: 4,
      }}
    >
      <Box
        sx={{
          px: { xs: 2, md: 4 },
          py: 3,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="subtitle1" fontWeight={600}>
            ContentLab
          </Typography>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
          <Typography variant="body2" color="text.secondary">
            © {new Date().getFullYear()} ContentLab · Alle Rechte vorbehalten
          </Typography>
        </Stack>
        <Stack direction="row" spacing={{ xs: 2, md: 3 }} flexWrap="wrap">
          {footerLinks.map((link) => (
            <Link key={link.label} href={link.href} underline="hover" color="text.secondary" fontSize="0.9rem">
              {link.label}
            </Link>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
