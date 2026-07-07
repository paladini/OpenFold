import { generateProblem, type DifficultyPreset } from '@openfold/core'
import { ProblemScene } from '../src/ProblemScene'

const viewport = document.getElementById('viewport') as HTMLDivElement
const seedInput = document.getElementById('seed') as HTMLInputElement
const presetSelect = document.getElementById('preset') as HTMLSelectElement
const regenBtn = document.getElementById('regen') as HTMLButtonElement
const foldBtn = document.getElementById('fold') as HTMLButtonElement
const unfoldBtn = document.getElementById('unfold') as HTMLButtonElement
const scrub = document.getElementById('scrub') as HTMLInputElement
const status = document.getElementById('status') as HTMLSpanElement
const badge = document.getElementById('badge') as HTMLDivElement

const scene = new ProblemScene()

function regenerate(): void {
  const seed = Number(seedInput.value) || 0
  const preset = presetSelect.value as DifficultyPreset
  const problem = generateProblem(seed, preset)
  scene.mount(viewport, problem)
  scene.setInteractive(true)
  scrub.value = '0'
  status.textContent = `seed=${seed} preset=${preset} correctIndex=${problem.correctIndex}`

  scene.onSelect((index) => {
    status.textContent = index === problem.correctIndex ? `Correct! (chose ${index})` : `Wrong (chose ${index}, correct was ${problem.correctIndex})`
    scene.showFeedback(problem.correctIndex, index)
  })

  badge.style.display = 'block'
  scene.anchors?.subscribe('face:0', (pos) => {
    if (!pos.visible) {
      badge.style.display = 'none'
      return
    }
    badge.style.display = 'block'
    badge.style.left = `${pos.x}px`
    badge.style.top = `${pos.y}px`
  })

  requestAnimationFrame(function loop() {
    scene.resize()
    requestAnimationFrame(loop)
  })
}

regenBtn.addEventListener('click', regenerate)
foldBtn.addEventListener('click', () => {
  void scene.playFold()
})
unfoldBtn.addEventListener('click', () => {
  void scene.playUnfold()
})
scrub.addEventListener('input', () => {
  scene.setProgress(Number(scrub.value))
})

window.addEventListener('resize', () => scene.resize())

regenerate()
