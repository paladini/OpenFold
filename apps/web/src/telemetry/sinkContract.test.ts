import { InMemorySink } from './InMemorySink'
import { describeSinkContract } from './sinkContractSuite'

describeSinkContract('InMemorySink', () => new InMemorySink())
