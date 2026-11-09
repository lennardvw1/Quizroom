# Quizroom

A small, self-hosted quiz game for making question packs and playing live with friends. It includes a starter library of general knowledge, geography, science, nature, and wordplay questions, plus a custom pack maker.

Choose a game mode when hosting:

- **Classic:** faster correct answers earn more points.
- **Streak:** consecutive correct answers earn up to 3× points.
- **Survival:** each player starts with three lives; eliminated players can spectate.

The **Games** page also has solo practice and join-code rooms for Snake, a coin-collecting platformer, five-wave tower defense, and Meteor Dash. Questions appear on each fruit, coin, or star, and at each tower-defense wave. Those milestones only award points or tower cash for correct answers. Tower defense has Scout, Sniper, and splash-damage Cannon towers, each with a different price and firing profile. Arcade rooms keep a live score table while each player plays their own run.

## Run locally

Requires Node.js 18 or newer. Start the app with:

```sh
npm start
```

Open http://localhost:3000. Create a pack or use the included general-knowledge pack, then choose **Host a game**. Friends can join with the six-digit room code from another browser or device that can reach the same server.

Packs are saved in the browser's local storage. Live rooms are kept in server memory and are cleared when the server restarts; deploy or expose the server on a network your friends can access to play remotely.