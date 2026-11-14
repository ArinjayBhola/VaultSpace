export function activityLabel(event: string) {
  const labels: Record<string, string> = {
    file_uploaded: 'Added a new file',
    file_renamed: 'Updated a file',
    file_move: 'Moved a file',
    file_trash: 'Moved a file to trash',
    file_delete: 'Requested permanent deletion',
    file_restored: 'Restored a file',
    file_restore: 'Restored a file',
    file_star: 'Starred a file',
    file_unstar: 'Removed a star',
    file_permanently_deleted: 'Permanently deleted a file',
    share_created: 'Created a share link',
    share_revoked: 'Revoked shared access',
    processing_completed: 'Preview and text preparation completed',
    processing_failed: 'File preparation needs attention',
    collection_created: 'Created a collection',
    folder_created: 'Created a folder',
  };
  return (
    labels[event] ??
    event
      .replaceAll('_', ' ')
      .replace(/^./, (character) => character.toUpperCase())
  );
}
