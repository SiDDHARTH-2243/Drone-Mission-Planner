# SKYCOMMAND GCS - Autonomous Drone Mission Planner

![Live Demo](https://img.shields.io/badge/Live_Demo-Online-success?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-Ready-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=for-the-badge&logo=typescript)

**[View Live Deployment on Vercel](https://drone-mission-planner-roan.vercel.app)**

## Architecture Overview
SKYCOMMAND GCS is a high-density, web-based Ground Control Station (GCS) engineered for tactical drone routing and MAVLink payload simulation. Built to mirror defense-grade and industrial aerospace interfaces, this frontend application translates visual mapping commands into mathematical flight paths and autonomous execution arrays.

## Core Engineering Features
* **Geospatial Path Generation:** Utilizes React-Leaflet rendering layered with Turf.js for advanced geometric calculations, including polygon midpoints, precise shape generation, and center-of-mass anchor translation.
* **Complex State Management:** Handles dynamic array splicing, real-time node dragging, and chronological waypoint sequencing without state mutation errors.
* **MAVLink Telemetry Simulation:** Real-time compilation of UI map geometry into standard MAVLink JSON execution payloads for flight controller integration.
* **Tactical UI/UX:** High-contrast interface designed for rapid field deployment, featuring tile-stacked satellite labeling, functional parameter filtering, and one-click coordinate resetting.
* **Hardware Context Enforcement:** Implements a strict viewport-based interception overlay preventing mobile access, enforcing the necessity of tablet/desktop resolutions for high-density operational data.

## Tech Stack
* **Framework:** Next.js (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Mapping:** React-Leaflet (OSM & Esri Satellite Layers)
* **Spatial Math:** Turf.js
* **Icons:** Lucide React

## Local Environment Setup
To run this simulation interface locally:

```bash
# Clone the repository
git clone [https://github.com/SiDDHARTH-2243/Drone-Mission-Planner.git](https://github.com/SiDDHARTH-2243/Drone-Mission-Planner.git)

# Navigate into the directory
cd Drone-Mission-Planner

# Install dependencies
npm install

# Start the local development server
npm run dev
