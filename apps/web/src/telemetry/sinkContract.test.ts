import 'fake-indexeddb/auto'
import { DexieSink } from '../storage/DexieSink'
import { OpenFoldDB } from '../storage/db'
import { InMemorySink } from './InMemorySink'
import { describeSinkContract } from './sinkContractSuite'

describeSinkContract('InMemorySink', () => new InMemorySink())

let dexieDbCounter = 0
describeSinkContract('DexieSink', () => new DexieSink(new OpenFoldDB(`sink-contract-test-${(dexieDbCounter += 1)}`)))
