import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getControlledTurntableTrack,
  getTonearmRotation,
  TONEARM_PLAY_END_DEGREES,
  TONEARM_PLAY_START_DEGREES,
  TONEARM_REST_DEGREES,
} from './vinylRecordMotion';
import type { PlayerTrack } from '@/context/PlayerContext';

const featuredTrack: PlayerTrack = {
  slug: 'featured-song',
  title: 'Featured Song',
  artist: 'Monsta Jam',
  color: '#00e5ff',
  audioUrl: '/featured.mp3',
};

const libraryTrack: PlayerTrack = {
  slug: 'library-song',
  title: 'Library Song',
  artist: 'Monsta Jam',
  color: '#ff00ff',
  audioUrl: '/library.mp3',
};

describe('getTonearmRotation', () => {
  it('parks the arm at rest when playback is stopped', () => {
    assert.equal(getTonearmRotation(false, 0.6), TONEARM_REST_DEGREES);
  });

  it('lands on the lead-in groove when playback starts', () => {
    assert.equal(getTonearmRotation(true, 0), TONEARM_PLAY_START_DEGREES);
  });

  it('tracks inward as the song progresses and clamps invalid progress', () => {
    assert.equal(getTonearmRotation(true, 1), TONEARM_PLAY_END_DEGREES);
    assert.equal(getTonearmRotation(true, -1), TONEARM_PLAY_START_DEGREES);
    assert.equal(getTonearmRotation(true, 4), TONEARM_PLAY_END_DEGREES);
  });
});

describe('getControlledTurntableTrack', () => {
  it('uses the featured track as the turntable target even when another track is active', () => {
    const state = getControlledTurntableTrack({
      currentTrack: libraryTrack,
      featuredTrack,
      isPlaying: true,
    });

    assert.equal(state.displayTrack, featuredTrack);
    assert.equal(state.clickTrack, featuredTrack);
    assert.equal(state.isTurntablePlaying, false);
  });

  it('shows the turntable as playing only when the featured track is active', () => {
    const state = getControlledTurntableTrack({
      currentTrack: featuredTrack,
      featuredTrack,
      isPlaying: true,
    });

    assert.equal(state.displayTrack, featuredTrack);
    assert.equal(state.clickTrack, featuredTrack);
    assert.equal(state.isTurntablePlaying, true);
  });

  it('falls back to the current track when no featured track is available', () => {
    const state = getControlledTurntableTrack({
      currentTrack: libraryTrack,
      featuredTrack: null,
      isPlaying: true,
    });

    assert.equal(state.displayTrack, libraryTrack);
    assert.equal(state.clickTrack, libraryTrack);
    assert.equal(state.isTurntablePlaying, true);
  });
});
