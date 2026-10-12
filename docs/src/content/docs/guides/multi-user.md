---
title: Multiple Users
description: Share one Koito instance with your family, with separate listening histories and privacy settings.
---

A single Koito instance can hold the listening history of several people. Each person has their own account, their own API key, and their own listens. Artists, albums and tracks (the catalog) are shared, so the same song is only stored once.

## Adding a user

Log in as an admin, open **Settings → Users**, and fill in a username and password. Koito creates the account and shows its first API key once: this is the token that person's scrobbler uses to submit listens.

Each person's scrobbler must submit with **their own** API key. Listens are recorded for the account that owns the key.

## Who can see what

Each user chooses who can see their listens, in **Settings → Account**:

| Setting | Who can see it |
| --- | --- |
| Public | Anyone, including visitors who are not logged in |
| Members only | Anyone logged in to this instance |
| Private | The user themselves and admins |

Existing accounts stay **Public** when you upgrade, so a single-user instance behaves as before. New accounts created from the Users tab default to **Members only**.

:::note
Admins can see every profile. If `KOITO_LOGIN_GATE` is on, visitors must log in to see anything, so Public and Members only behave the same.
:::

## Switching between profiles

When more than one profile is visible to you, a **Switch user** button appears in the sidebar. Pick someone's profile, or **Everyone** for the combined listens of every profile you are allowed to see. The **Family** page shows each person's plays this week, their top artist, and what they are playing right now.

The same choice is available to scripts and widgets through the `user` query parameter, for example `/apis/web/v1/stats?user=alice` or `?user=all`. Without it, you see your own data.

## What only admins can do

Merging and deleting artists, albums and tracks changes the catalog everyone shares, so these actions, and purging all data, are limited to admins. Anyone can still edit aliases, images and MusicBrainz IDs.

## Setting up the scrobbler

Create one Koito client per person, each with that person's API key, and send each person's player (for example each Navidrome user in Multi-Scrobbler) to their own client. See the [Multi-Scrobbler documentation](https://foxxmd.github.io/multi-scrobbler/) for how to restrict a source to specific clients.
