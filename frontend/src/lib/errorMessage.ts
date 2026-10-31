const messages: Record<string, string> = {
  'unauthorized: invalid token': 'La sessione non è valida. Esci e accedi di nuovo. Se il problema continua, verifica la configurazione Supabase del backend.',
  'unauthorized: missing bearer token': 'Accedi di nuovo per continuare.',
  invalid_icloud_link: 'Inserisci il link pubblico di un Album Condiviso iCloud.',
  invalid_invite_code: 'Il codice invito non è valido. Controllalo e riprova.',
  could_not_create_album: 'Non è stato possibile creare l’album. Riprova.',
  could_not_list_albums: 'Non è stato possibile caricare gli album. Riprova.',
  could_not_regenerate_invite: 'Non è stato possibile rigenerare il codice. Riprova.',
  album_not_found_or_not_owner: 'Album non disponibile oppure non hai i permessi per modificarlo.',
  album_not_found_or_forbidden: 'Album non disponibile oppure non hai accesso.',
  icloud_album_unreachable: 'Album iCloud non raggiungibile. Verifica che il link sia pubblico, poi riprova.',
  could_not_sync_photos: 'Non è stato possibile sincronizzare le foto. Riprova.',
  could_not_list_photos: 'Non è stato possibile caricare le foto. Riprova.',
  could_not_update_location: 'Non è stato possibile salvare la posizione. Riprova.',
  'Invalid login credentials': 'Email o password non corrette.',
  invalid_credentials: 'Email o password non corrette.',
  'Email not confirmed': 'Conferma la tua email prima di accedere.',
  'Failed to fetch': 'Connessione non riuscita. Verifica la rete e che il backend sia avviato.',
};

export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return messages[message] ?? 'Operazione non riuscita. Verifica la connessione e riprova.';
}
