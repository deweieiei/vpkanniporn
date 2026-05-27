-- รันบน HostAtom phpMyAdmin: เลือก database vpkann_database -> tab SQL -> paste -> Go

ALTER TABLE users
  ADD COLUMN cover_images JSON NULL;
