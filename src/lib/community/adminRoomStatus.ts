type CommunityRoomPublicationInput = {
  isOpen: boolean;
  publicEnabled: boolean;
};

export type CommunityRoomAdminStatus = {
  label: 'Live' | 'Prepared' | 'Invite pending';
  isLive: boolean;
  saveMessage: string;
};

export function getCommunityRoomAdminStatus({
  isOpen,
  publicEnabled,
}: CommunityRoomPublicationInput): CommunityRoomAdminStatus {
  if (isOpen && publicEnabled) {
    return {
      label: 'Live',
      isLive: true,
      saveMessage: 'Community room is open to fans.',
    };
  }

  if (isOpen) {
    return {
      label: 'Prepared',
      isLive: false,
      saveMessage: 'Community room settings saved. Public Talk remains Coming Soon until the deployment gate is enabled.',
    };
  }

  return {
    label: 'Invite pending',
    isLive: false,
    saveMessage: 'Community room settings saved.',
  };
}
