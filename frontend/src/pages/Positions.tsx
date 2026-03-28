import React, { type ReactElement } from 'react';

import { PositionsSummary, OpenPositionsTable, ClosedPositionsTable } from '../components/positions';
import { MOCK_OPEN_POSITIONS, MOCK_CLOSED_POSITIONS } from '../mocks/positionsData';

function Positions(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">
        Positions & P&L
      </h1>

      <PositionsSummary
        openPositions={MOCK_OPEN_POSITIONS}
        closedPositions={MOCK_CLOSED_POSITIONS}
      />

      <OpenPositionsTable positions={MOCK_OPEN_POSITIONS} />

      <ClosedPositionsTable positions={MOCK_CLOSED_POSITIONS} />
    </div>
  );
}

export default Positions;
