function getRematchVoteState(room) {
  const votes = room.rematchVotes || { yes: [], no: [], resolved: false, message: '' };
  const eligible = room.players.filter((player) => player.connected).length;
  return {
    yes: [...votes.yes],
    no: [...votes.no],
    eligible,
    resolved: Boolean(votes.resolved),
    message: votes.message || '',
  };
}

function castRematchVote(room, playerId, choice, createGameForMode) {
  if (room.status !== 'finished') throw new Error('Voting rematch hanya tersedia setelah permainan selesai.');
  if (!['yes', 'no'].includes(choice)) throw new Error('Pilihan voting tidak valid.');
  if (!room.rematchVotes) room.rematchVotes = { yes: [], no: [], resolved: false, message: '' };
  const votes = room.rematchVotes;
  if (votes.resolved) throw new Error('Voting rematch sudah selesai.');
  if (votes.yes.includes(playerId) || votes.no.includes(playerId)) throw new Error('Kamu sudah memberikan suara.');
  if (!room.players.some((player) => player.id === playerId && player.connected)) throw new Error('Pemain tidak termasuk peserta voting aktif.');

  const eligiblePlayers = room.players.filter((player) => player.connected);
  if (eligiblePlayers.length < 2) throw new Error('Minimal 2 pemain online untuk memulai rematch.');
  votes[choice].push(playerId);
  const eligibleIds = new Set(eligiblePlayers.map((player) => player.id));
  votes.yes = votes.yes.filter((id) => eligibleIds.has(id));
  votes.no = votes.no.filter((id) => eligibleIds.has(id));
  const majority = Math.floor(eligiblePlayers.length / 2) + 1;
  if (votes.yes.length >= majority) {
    room.players = eligiblePlayers;
    room.game = createGameForMode(room.players, room.gameMode);
    room.status = 'playing';
    room.rematchVotes = { yes: [], no: [], resolved: false, message: '' };
    return { restarted: true };
  }
  if (votes.no.length >= majority) {
    votes.resolved = true;
    votes.message = 'Mayoritas memilih tidak bermain lagi.';
    return { restarted: false };
  }
  if (votes.yes.length + votes.no.length >= eligiblePlayers.length) {
    votes.resolved = true;
    votes.message = 'Voting seri; rematch tidak dimulai.';
  }
  return { restarted: false };
}

module.exports = { getRematchVoteState, castRematchVote };
